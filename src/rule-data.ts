import { globSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

export type RuleSummary = { name: string; content: string; path: string }
type InstructionPathsOptions = { directory: string; worktree: string; configDir: string; home: string; instructions: string[] }

export function collectInstructionPaths(options: InstructionPathsOptions): string[] {
  const paths = new Set<string>(); const add = (value: string) => { if (value) paths.add(path.resolve(value)) }
  for (const pattern of options.instructions) for (const filepath of globSync(pattern, { cwd: options.directory, absolute: true, nodir: true })) add(filepath)
  for (const candidate of [path.join(options.worktree, "AGENTS.md"), path.join(options.worktree, "CLAUDE.md"), path.join(options.configDir, "AGENTS.md"), path.join(options.home, ".claude", "CLAUDE.md")]) add(candidate)
  for (const directory of [options.directory, options.worktree, options.configDir, options.home, path.join(options.home, ".claude"), path.join(options.home, ".cursor", "rules")]) for (const candidate of ["AGENTS.md", "CLAUDE.md"]) add(path.join(directory, candidate))
  return [...paths].filter((filepath) => { try { return Boolean(readFileSync(filepath)) } catch { return false } })
}
export function toSummaries(paths: string[], contents = new Map<string, string>()): RuleSummary[] { return paths.map((filepath) => ({ name: path.basename(filepath).replace(/\.(mdc|md)$/i, ""), content: contents.get(filepath) ?? readFileSync(filepath, "utf8"), path: filepath })) }
export async function loadAvailableRules(api: TuiPluginApi): Promise<RuleSummary[]> { const configDir = path.join(os.homedir(), ".config", "opencode"); const home = os.homedir(); const directory = api.workspace?.directory ?? process.cwd(); const worktree = api.workspace?.worktree ?? directory; const config = await api.http.get<{ instructions?: string[] }>("/config"); return toSummaries(collectInstructionPaths({ directory, worktree, configDir, home, instructions: config.data?.instructions ?? [] })) }
export function extractLoadedRuleName(part: { type?: string; text?: string }, rules: RuleSummary[]): string | undefined { if (part.type !== "text" || !part.text) return undefined; return rules.find((rule) => part.text?.includes(rule.path))?.name }
export function scanLoadedRuleNames(api: TuiPluginApi, sessionID: string, loaded: Set<string>, scanned: Set<string>, rules: RuleSummary[]): boolean { let changed = false; for (const message of api.state.session.messages(sessionID)) { if (scanned.has(message.info.id)) continue; scanned.add(message.info.id); for (const part of message.parts) { const ruleName = extractLoadedRuleName(part, rules); if (ruleName && !loaded.has(ruleName)) { loaded.add(ruleName); changed = true } } } return changed }
export function seedSystemLoadedNames(rules: RuleSummary[], loaded: Set<string>): boolean { let changed = false; for (const rule of rules) if (!loaded.has(rule.name)) { loaded.add(rule.name); changed = true } return changed }
export async function fetchLoadedRuleNames(api: TuiPluginApi, sessionID: string, loaded: Set<string>, scanned: Set<string>, rules: RuleSummary[]): Promise<boolean> { const result = await api.http.get<{ data?: Array<{ info: { id: string }; parts: Array<{ type?: string; text?: string }> }> }>(`/session/${sessionID}/message?limit=100`); let changed = false; for (const message of result.data?.data ?? []) { if (scanned.has(message.info.id)) continue; scanned.add(message.info.id); for (const part of message.parts) { const ruleName = extractLoadedRuleName(part, rules); if (ruleName && !loaded.has(ruleName)) { loaded.add(ruleName); changed = true } } } return changed }
