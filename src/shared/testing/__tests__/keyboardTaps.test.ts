// Tests for step 10.6 — written before implementation (TDD)
//
// Found in the simulator: with the keyboard up, the first tap on "Add
// field", "Create persona", "Add" (tag), "Save" or a chat button was eaten —
// it only dismissed the keyboard and a second tap was needed. React Native's
// scroll containers default to keyboardShouldPersistTaps="never", which does
// exactly that. "handled" lets the tap reach the button (and still dismisses
// the keyboard when tapping empty space).
//
// A static guard, like routeTestIDs: every ScrollView / FlatList /
// SectionList in src/ must opt in, so a new screen can't regress.
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const SRC = join(__dirname, "../../..");
const SCROLLER = /<((?:\w+\.)?(?:ScrollView|FlatList|SectionList))(?=[\s>/])/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" || name === "__mocks__"
        ? []
        : sourceFiles(path);
    }
    return name.endsWith(".tsx") ? [path] : [];
  });
}

/** The full opening tag starting at `start` — `{…}` and strings skipped. */
function openingTag(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i];
    if (quote !== null) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

function missingPersistTaps(file: string, source: string): string[] {
  const problems: string[] = [];
  for (const match of source.matchAll(SCROLLER)) {
    const tag = openingTag(source, match.index);
    if (!/\bkeyboardShouldPersistTaps="handled"/.test(tag)) {
      const line = source.slice(0, match.index).split("\n").length;
      problems.push(`${file}:${line} <${match[1]}>`);
    }
  }
  return problems;
}

describe("missingPersistTaps (the guard itself)", () => {
  it("flags a scroller without the prop", () => {
    expect(missingPersistTaps("x.tsx", "<ScrollView style={s}>")).toEqual([
      "x.tsx:1 <ScrollView>",
    ]);
  });

  it("accepts the prop anywhere in a multi-line tag with arrow props", () => {
    const tag = `<FlatList\n  data={d}\n  renderItem={({ item }) => <Row />}\n  keyboardShouldPersistTaps="handled"\n/>`;
    expect(missingPersistTaps("x.tsx", tag)).toEqual([]);
  });

  it("rejects the other values", () => {
    expect(
      missingPersistTaps(
        "x.tsx",
        '<SectionList keyboardShouldPersistTaps="never" />',
      ),
    ).toHaveLength(1);
  });

  it("also checks namespaced scrollers like Animated.ScrollView", () => {
    expect(missingPersistTaps("x.tsx", "<Animated.ScrollView />")).toEqual([
      "x.tsx:1 <Animated.ScrollView>",
    ]);
  });

  it("ignores names that only start the same way", () => {
    expect(missingPersistTaps("x.tsx", "<ScrollViewish />")).toEqual([]);
  });
});

describe("every scroll container in src/", () => {
  it("lets taps through while the keyboard is up", () => {
    const problems = sourceFiles(SRC).flatMap((path) =>
      missingPersistTaps(relative(SRC, path), readFileSync(path, "utf8")),
    );
    expect(problems).toEqual([]);
  });
});
