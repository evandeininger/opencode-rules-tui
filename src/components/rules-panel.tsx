import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { Accessor } from "solid-js"
import { For, Show } from "solid-js"
import type { RuleSummary } from "../rule-data"

export function RulesPanel(props: {
  rules: Accessor<RuleSummary[]>
  loadedNames: Accessor<Set<string>>
  loadedOnly: Accessor<boolean>
  theme: Accessor<TuiThemeCurrent>
  collapsed: Accessor<boolean>
  onToggle: () => void
  onRulePreview: (rule: RuleSummary) => void
}) {
  const visibleRules = () => {
    const loaded = props.loadedNames()
    return props.loadedOnly() ? props.rules().filter((rule) => loaded.has(rule.name)) : props.rules()
  }
  return (
    <box flexDirection="column" paddingTop={1} paddingLeft={1} paddingRight={1}>
      <box flexDirection="row" justifyContent="space-between" columnGap={1}>
        <text style={{ fg: props.theme().text }}>
          <strong>Rules</strong>
          <span style={{ fg: props.theme().textMuted }}> ({visibleRules().length})</span>
        </text>
        <text style={{ fg: props.theme().textMuted }} onMouseDown={() => props.onToggle()}>
          {props.collapsed() ? "▶" : "▼"}
        </text>
      </box>
      <Show when={!props.collapsed()}>
        <box flexDirection="column">
          <For each={visibleRules()}>
            {(rule) => (
              <box flexDirection="row" columnGap={1} onMouseDown={() => props.onRulePreview(rule)}>
                <text style={{ fg: props.loadedNames().has(rule.name) ? props.theme().success : props.theme().textMuted }}>
                  {props.loadedNames().has(rule.name) ? "●" : "○"}
                </text>
                <text style={{ fg: props.theme().text }}>{rule.name}</text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </box>
  )
