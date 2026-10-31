// Tests for step 10.37 — written before implementation (TDD)
//
// Claude now commits straight to main with no pull requests, so the local
// gate was the only check before code reached main. A GitHub Actions
// workflow re-runs the same gate on every push, on GitHub's machines.
// These tests read the workflow file as text (no YAML parser in the deps)
// and pin the parts that matter: when it runs, what it runs, and that it
// can't do anything but read the repo.
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const workflowPath = join(__dirname, "../../../../.github/workflows/ci.yml");

function readWorkflow(): string {
  return existsSync(workflowPath) ? readFileSync(workflowPath, "utf8") : "";
}

/** Lines that are actual YAML content (comments and blank lines dropped). */
function contentLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+#.*$/, "").trimEnd())
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
}

/** The lines nested under the first top-level-or-deeper `key:` line. */
function blockUnder(lines: string[], key: string): string[] {
  const start = lines.findIndex((line) =>
    new RegExp(`^\\s*${key}:\\s*$`).test(line),
  );
  if (start === -1) return [];
  const indent = lines[start].length - lines[start].trimStart().length;
  const block: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const lead = lines[i].length - lines[i].trimStart().length;
    if (lead <= indent) break;
    block.push(lines[i]);
  }
  return block;
}

/** Commands from `run:` steps, single-line or `run: |` blocks. */
function runCommands(text: string): string[] {
  const lines = contentLines(text);
  const commands: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const inline = match[2].trim();
    if (inline !== "|" && inline !== ">") {
      commands.push(inline);
      continue;
    }
    const indent = match[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      const lead = lines[j].length - lines[j].trimStart().length;
      if (lead <= indent) break;
      commands.push(lines[j].trim());
    }
  }
  return commands;
}

describe("CI workflow (10.37)", () => {
  it("exists at .github/workflows/ci.yml", () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it("runs on every push to main", () => {
    const lines = contentLines(readWorkflow());
    const on = blockUnder(lines, "on");
    const push = blockUnder(on, "push");
    expect(push.join("\n")).toMatch(/branches:\s*\[\s*["']?main["']?\s*\]/);
    // A paths/branches-ignore filter would let some pushes to main skip CI.
    expect(push.join("\n")).not.toMatch(/paths|branches-ignore|tags/);
  });

  it("installs from the lockfile and runs the full gate, in order", () => {
    const commands = runCommands(readWorkflow());
    const gate = [
      "npm ci",
      "npx tsc --noEmit",
      "npx jest --passWithNoTests",
      "npx eslint src",
    ];
    const positions = gate.map((cmd) => commands.indexOf(cmd));
    expect(positions).not.toContain(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  // A gate step that may fail quietly, or is skipped, is no gate at all.
  it("lets no gate step be skipped or fail quietly", () => {
    const text = contentLines(readWorkflow()).join("\n");
    expect(text).not.toMatch(/continue-on-error/);
    expect(text).not.toMatch(/^\s*(?:- )?if:/m);
    expect(text).not.toMatch(/\|\|\s*true/);
    expect(text).not.toMatch(/set \+e|exit 0/);
  });

  it("is indented with spaces only (a tab makes the YAML invalid)", () => {
    expect(readWorkflow()).not.toMatch(/\t/);
  });

  it("runs on Linux with the same Node major as development (22)", () => {
    const lines = contentLines(readWorkflow());
    expect(lines.join("\n")).toMatch(/^\s+runs-on:\s*ubuntu-latest\s*$/m);
    const setupNode = lines.findIndex((line) =>
      /uses:\s*actions\/setup-node@/.test(line),
    );
    expect(setupNode).not.toBe(-1);
    const withBlock = blockUnder(lines.slice(setupNode), "with");
    expect(withBlock.join("\n")).toMatch(/node-version:\s*["']?22["']?\s*$/m);
  });

  // The workflow only checks code. It gets a read-only token and no secrets,
  // so nothing it runs can push, publish, or send repo data anywhere.
  it("is read-only and uses no secrets", () => {
    const text = contentLines(readWorkflow()).join("\n");
    expect(text).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
    expect(text).not.toMatch(/\bwrite\b/);
    expect(text).not.toMatch(/secrets\./);
  });

  // "Every push" means every push gets a result: a newer push must not
  // cancel the run for an older one.
  it("never cancels the run for an earlier push", () => {
    expect(readWorkflow()).not.toMatch(/cancel-in-progress:\s*true/);
  });
});
