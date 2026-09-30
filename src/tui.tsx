/** @jsxImportSource @opentui/solid */

import type { TuiPlugin, TuiPluginApi, TuiPluginModule, TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import { SyntaxStyle } from "@opentui/core"
import type { MouseEvent } from "@opentui/core"
import { Show, createSignal } from "solid-js"
import type { Accessor, JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { RulesPanel } from "./components/rules-panel"
import {
  extractLoadedRuleName,
  fetchLoadedRuleNames,
  loadAvailableRules,
  scanLoadedRuleNames,
  seedSystemLoadedNames,
  type RuleSummary,
} from "./rule-data"

const SIDEBAR_ORDER = 240
const COLLAPSED_KEY = "opencode-rules-tui.collapsed"
const LOADED_ONLY_KEY = "opencode-rules-tui.loaded-only"
const PREVIEW_WIDTH = 116

type TuiApi = TuiPluginApi & {
  keymap: {
    registerLayer: (layer: { commands: Array<{ name: string; namespace: string; title: string; desc: string; category: string; slashName: string; run: () => void }> }) => () => void
  }
}

function DialogShield(props: { width: number; theme: Accessor<TuiThemeCurrent>; onClose: () => void; children: JSX.Element }) {
  const dims = useTerminalDimensions()
  const rows = () => Math.max(6, dims().height - 4)
  const inContent = (x: number, y: number) => {
    const left = Math.floor((dims().width - props.width) / 2)
    return x >= left && x < left + props.width && y >= 2 && y < 2 + rows()
  }
  let downOutside = false
  const onDown = (event: MouseEvent) => { event.stopPropagation(); downOutside = !inContent(event.x, event.y) }
  const onUp = (event: MouseEvent) => { event.stopPropagation(); if (downOutside && !inContent(event.x, event.y)) props.onClose() }
  const swallow = (event: MouseEvent) => event.stopPropagation()
  return <box position="absolute" left={-Math.floor((dims().width - props.width) / 2)} top={-Math.floor(dims().height / 4)} width={dims().width} height={dims().height} flexDirection="column" alignItems="center" paddingTop={2} onMouseDown={onDown} onMouseUp={onUp} onMouseScroll={swallow}><box flexDirection="column" rowGap={1} paddingBottom={1} paddingLeft={8} paddingRight={8} width={props.width} height={rows()} backgroundColor={props.theme().backgroundPanel}>{props.children}</box></box>
}

function RulePreviewDialog(props: { rule: RuleSummary; theme: Accessor<TuiThemeCurrent>; onClose: () => void }) {
  return <DialogShield width={PREVIEW_WIDTH} theme={props.theme} onClose={props.onClose}><box flexDirection="row" justifyContent="space-between" columnGap={2}><text style={{ fg: props.theme().text }}><strong>{props.rule.name}</strong></text><text style={{ fg: props.theme().textMuted }}>esc to close</text></box><Show when={props.rule.path}><text style={{ fg: props.theme().textMuted }}>{props.rule.path}</text></Show><scrollbox flexGrow={1} minHeight={0}><markdown content={props.rule.content} syntaxStyle={SyntaxStyle.create()} /></scrollbox></DialogShield>
}

const tui: TuiPlugin = async (rawApi) => {
  const api = rawApi as TuiApi
  const [rules, setRules] = createSignal<RuleSummary[]>([])
  const [loadVersion, setLoadVersion] = createSignal(0)
  const [collapsed, setCollapsed] = createSignal(Boolean(api.kv.get(COLLAPSED_KEY, false)))
  const [loadedOnly, setLoadedOnly] = createSignal(Boolean(api.kv.get(LOADED_ONLY_KEY, false)))
  const loadedBySession = new Map<string, Set<string>>()
  const scannedBySession = new Map<string, Set<string>>()
  const fallbackAttempted = new Set<string>()
  let refreshTimer: ReturnType<typeof setTimeout> | undefined
  const loadedRefreshTimers = new Set<ReturnType<typeof setTimeout>>()
  let visibleSessionID: string | undefined
  const toggleCollapsed = () => { const next = !collapsed(); setCollapsed(next); api.kv.set(COLLAPSED_KEY, next) }
  const toggleLoadedOnly = () => { const next = !loadedOnly(); setLoadedOnly(next); api.kv.set(LOADED_ONLY_KEY, next); api.ui.toast({ variant: "info", title: "Rules", message: next ? "Sidebar shows loaded rules only" : "Sidebar shows all rules", duration: 2000 }) }
  const openRulePreview = (rule: RuleSummary) => { api.ui.dialog.replace(() => <RulePreviewDialog rule={rule} theme={() => api.theme.current} onClose={() => api.ui.dialog.clear()} />); api.ui.dialog.setSize("xlarge") }
  const getLoadedRules = (sessionID: string) => {
    const loaded = loadedBySession.get(sessionID); const scanned = scannedBySession.get(sessionID)
    if (loaded && scanned) { seedSystemLoadedNames(rules(), loaded); return loaded }
    const nextLoaded = loaded ?? new Set<string>(); const nextScanned = scanned ?? new Set<string>()
    loadedBySession.set(sessionID, nextLoaded); scannedBySession.set(sessionID, nextScanned); seedSystemLoadedNames(rules(), nextLoaded)
    const messages = api.state.session.messages(sessionID); scanLoadedRuleNames(api, sessionID, nextLoaded, nextScanned, rules())
    if (messages.length === 0 && !fallbackAttempted.has(sessionID)) { fallbackAttempted.add(sessionID); void fetchLoadedRuleNames(api, sessionID, nextLoaded, nextScanned, rules()).then((changed) => { if (changed) setLoadVersion((value) => value + 1) }).catch(() => {}) }
    return nextLoaded
  }
  const refreshLoadedRules = (sessionID: string) => { const loaded = loadedBySession.get(sessionID); const scanned = scannedBySession.get(sessionID); if (loaded && scanned) { const seeded = seedSystemLoadedNames(rules(), loaded); const scannedChanged = scanLoadedRuleNames(api, sessionID, loaded, scanned, rules()); if (seeded || scannedChanged) setLoadVersion((value) => value + 1); return }; getLoadedRules(sessionID); setLoadVersion((value) => value + 1) }
  const scheduleRefreshLoadedRules = (sessionID: string, delay = 0) => { const timer = setTimeout(() => { loadedRefreshTimers.delete(timer); refreshLoadedRules(sessionID) }, delay); loadedRefreshTimers.add(timer) }
  const markLoaded = (sessionID: string, ruleName: string) => { const loaded = getLoadedRules(sessionID); const sizeBefore = loaded.size; loaded.add(ruleName); if (loaded.size !== sizeBefore) setLoadVersion((value) => value + 1) }
  const refreshRules = async () => { try { setRules(await loadAvailableRules(api)); scannedBySession.clear(); for (const sessionID of loadedBySession.keys()) refreshLoadedRules(sessionID); setLoadVersion((value) => value + 1) } catch (error) { api.ui.toast({ variant: "error", title: "Rules", message: `Failed to load rules: ${error instanceof Error ? error.message : String(error)}`, duration: 5000 }) } }
  const scheduleRefreshRules = (delay = 0) => { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { refreshTimer = undefined; void refreshRules() }, delay) }
  void refreshRules(); scheduleRefreshRules(250)
  const unregisterMessagePartUpdated = api.event.on("message.part.updated", (event) => { const ruleName = extractLoadedRuleName(event.properties.part, rules()); if (ruleName) markLoaded(event.properties.sessionID, ruleName) })
  const unregisterSessionDeleted = api.event.on("session.deleted", (event) => { const removed = loadedBySession.delete(event.properties.sessionID) || scannedBySession.delete(event.properties.sessionID); if (removed) setLoadVersion((value) => value + 1) })
  const unregisterProjectUpdated = api.event.on("project.updated", () => scheduleRefreshRules())
  const unregisterWorkspaceReady = api.event.on("workspace.ready", () => scheduleRefreshRules())
  const unregisterWorktreeReady = api.event.on("worktree.ready", () => scheduleRefreshRules())
  const unregisterKeymap = api.keymap.registerLayer({ commands: [{ name: "rules-toggle", namespace: "palette", title: "Rules Toggle", desc: "Toggle showing only loaded rules in the sidebar", category: "Rules", slashName: "rules-toggle", run() { toggleLoadedOnly() } }] })
  api.lifecycle.onDispose(() => { if (refreshTimer) clearTimeout(refreshTimer); for (const timer of loadedRefreshTimers) clearTimeout(timer); loadedRefreshTimers.clear(); unregisterMessagePartUpdated(); unregisterSessionDeleted(); unregisterProjectUpdated(); unregisterWorkspaceReady(); unregisterWorktreeReady(); unregisterKeymap() })
  api.slots.register({ order: SIDEBAR_ORDER, slots: { sidebar_content: (_ctx, props) => { if (visibleSessionID !== props.session_id) { visibleSessionID = props.session_id; scheduleRefreshLoadedRules(props.session_id, 500) }; loadVersion(); return <RulesPanel rules={rules} loadedNames={() => { loadVersion(); return getLoadedRules(props.session_id) }} loadedOnly={loadedOnly} theme={() => api.theme.current} collapsed={collapsed} onToggle={toggleCollapsed} onRulePreview={openRulePreview} /> } } })
}

const plugin: TuiPluginModule & { id: string } = { id: "opencode-rules-tui", tui }
export default plugin
