import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { collectInstructionPaths, extractLoadedRuleName, seedSystemLoadedNames, toSummaries } from "./rule-data.ts"

const home = os.homedir()
const configDir = path.join(home, ".config", "opencode")
const rulesDir = path.join(home, ".cursor", "rules")

describe("collectInstructionPaths", () => {
  it("discovers configured .mdc instruction files", () => {
    const paths = collectInstructionPaths({
      directory: path.join(home, ".config"),
      worktree: "/",
      configDir,
      home,
      instructions: [path.join(rulesDir, "*.mdc")],
    })

    const names = paths.map((item) => path.basename(item)).sort()
    assert.deepEqual(names, ["git-branch-naming.mdc", "guidelines.mdc", "openviking-memory.mdc"])
  })

  it("includes a project AGENTS.md when present", () => {
    const paths = collectInstructionPaths({
      directory: path.join(home, ".config", "opencode", "plugins", "rules-tui"),
      worktree: path.join(home, ".config", "opencode", "plugins", "rules-tui"),
      configDir,
      home,
      instructions: [],
    })

    assert.ok(!paths.some((item) => item.endsWith("AGENTS.md")))
  })
})

describe("toSummaries", () => {
  it("uses file stems as names", () => {
    const filepath = path.join(rulesDir, "guidelines.mdc")
    const rules = toSummaries([filepath], new Map([[filepath, "# Guidelines"]]))
    assert.equal(rules.length, 1)
    assert.equal(rules[0].name, "guidelines")
    assert.equal(rules[0].path, filepath)
  })
})

describe("seedSystemLoadedNames", () => {
  it("marks every discovered instruction as loaded", () => {
    const loaded = new Set<string>()
    const changed = seedSystemLoadedNames(
      [
        { name: "guidelines", content: "a", path: "guidelines.mdc" },
        { name: "git-branch-naming", content: "b", path: "git-branch-naming.mdc" },
      ],
      loaded,
    )
    assert.equal(changed, true)
    assert.deepEqual([...loaded].sort(), ["git-branch-naming", "guidelines"])
  })
})

describe("extractLoadedRuleName", () => {
  const rules = [
    {
      name: "guidelines",
      content: "# Guidelines\nDo not assume.",
      path: path.join(rulesDir, "guidelines.mdc"),
    },
  ]

  it("detects OpenCode instruction injection tags", () => {
    const name = extractLoadedRuleName(
      {
        type: "text",
        text: `Instructions from: ${rules[0].path}\n# Guidelines\nDo not assume.`,
      } as never,
      rules,
    )
    assert.equal(name, "guidelines")
  })
})
