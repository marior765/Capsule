// Tests for 8.10 (testID retrofit) — written before implementation (TDD).
// A static guard: every interactive element in a route under src/app/ must
// carry a testID taken from a `testIDs` object (createComponentTestIDs),
// never a hardcoded string. Widgets were covered as they were built; routes
// were not, and nothing stopped a new one from regressing.
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const APP_ROOT = join(__dirname, "../../../app");
const INTERACTIVE =
  /<((?:Animated\.)?(?:Animated)?Pressable|TextInput|Switch|TouchableOpacity|TouchableHighlight|Link|Button)(?=[\s>/])/g;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : routeFiles(path);
    }
    return name.endsWith(".tsx") ? [path] : [];
  });
}

/** The full opening tag starting at `start` — `{…}` and strings skipped, so `=>` doesn't end it. */
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

/** "file:line <Element>" for every interactive element without a testIDs-object testID. */
function missingTestIDs(file: string, source: string): string[] {
  const problems: string[] = [];
  for (const match of source.matchAll(INTERACTIVE)) {
    const tag = openingTag(source, match.index);
    const testID = /\btestID=\{\s*(`\$\{)?\s*testIDs\./.test(tag);
    if (!testID) {
      const line = source.slice(0, match.index).split("\n").length;
      problems.push(`${file}:${line} <${match[1]}>`);
    }
  }
  return problems;
}

describe("missingTestIDs (the guard itself)", () => {
  it.each([
    "<Animated.Pressable onPress={f} />",
    "<AnimatedPressable onPress={f} />",
    "<Link href='/x' onPress={f} />",
    "<Button onPress={f} />",
  ])("also checks %s", (tag) => {
    expect(missingTestIDs("f", tag)).toHaveLength(1);
  });

  it("flags an element with no testID", () => {
    expect(missingTestIDs("f", "<Pressable onPress={() => go()}>")).toEqual([
      "f:1 <Pressable>",
    ]);
  });

  it("flags a hardcoded string testID", () => {
    expect(missingTestIDs("f", '<TextInput testID="btn_x" />')).toHaveLength(1);
  });

  it("accepts a testIDs-object reference, plain or id-suffixed", () => {
    expect(
      missingTestIDs(
        "f",
        "<Pressable\n onPress={() => a > b}\n testID={testIDs.buttons.save}>\n" +
          "<Pressable testID={`${testIDs.pressables.row}_${id}`} />",
      ),
    ).toEqual([]);
  });

  it("does not mistake a `=>` inside a prop for the end of the tag", () => {
    expect(
      missingTestIDs(
        "f",
        "<Pressable onPress={() => x}\n testID={testIDs.buttons.a}>",
      ),
    ).toEqual([]);
  });
});

describe("every route under src/app (8.10)", () => {
  it("gives every interactive element a testID from its testIDs object", () => {
    const problems = routeFiles(APP_ROOT).flatMap((path) =>
      missingTestIDs(relative(APP_ROOT, path), readFileSync(path, "utf8")),
    );
    expect(problems).toEqual([]);
  });

  it("exposes the testIDs object as a static property of the component it names", () => {
    const problems = routeFiles(APP_ROOT).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      if (!source.includes("createComponentTestIDs(")) return [];
      const name = /createComponentTestIDs\(\s*"(\w+)"/.exec(source)?.[1];
      return name !== undefined && source.includes(`${name}.testIDs = testIDs;`)
        ? []
        : [relative(APP_ROOT, path)];
    });
    expect(problems).toEqual([]);
  });
});
