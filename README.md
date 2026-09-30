# opencode-rules-tui

OpenCode TUI plugin that shows instruction and rule files currently in context.

## Install

Add the published plugin version to `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    "opencode-rules-tui@1.0.0"
  ]
}
```

Restart OpenCode after changing the configuration. OpenCode downloads the package and loads its TUI entry point.

Use the `Rules Toggle` command from the command palette to switch between all discovered rules and rules loaded in the current session.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```

The build writes the bundled plugin to `dist/tui.js`.

## License

MIT
