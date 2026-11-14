// Tests for step 10.56 (round 3) — written before implementation (TDD)
//
// Reviewer finding: Jest runs without the React Compiler, but the app runs
// with it, and the compiler infers each memo's inputs from the values the
// code actually uses. A dependency that is only listed (or `void`ed) is
// dropped, which left the board stale after an edit made on another screen.
// So this compiles the hook with babel-plugin-react-compiler and checks the
// guard of every database read in the compiled output.
import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(
  join(__dirname, "../useCapsuleListQueries.ts"),
  "utf8",
);

function compile(code: string): string {
  const babel = jest.requireActual<typeof import("@babel/core")>("@babel/core");
  const result = babel.transformSync(code, {
    filename: "useCapsuleListQueries.ts",
    babelrc: false,
    configFile: false,
    presets: [["@babel/preset-typescript", {}]],
    plugins: [["babel-plugin-react-compiler", {}]],
  });
  if (!result?.code) throw new Error("compile failed");
  return result.code;
}

/** The condition of the nearest compiled memo guard (`if (...)`) before `at`. */
function guardBefore(code: string, at: number): string {
  const start = code.lastIndexOf("if (", at);
  if (start === -1) return "";
  const end = code.indexOf(") {", start);
  return code.slice(start, end);
}

describe("useCapsuleListQueries under the React Compiler (10.56)", () => {
  const compiled = compile(source);

  it("compiles (the compiler doesn't bail out on it)", () => {
    expect(compiled).toMatch(/_c\(\d+\)/); // the compiler's memo cache
  });

  // The board's reads, as called inside the hook (they're module-level
  // helpers so the reloaded capsules are a real, used argument).
  const inHook = (call: string): number =>
    compiled.indexOf(call, compiled.indexOf("function useCapsuleListQueries"));

  it.each(["readBoardValues(db", "readFieldsByType(db"])(
    "re-runs %s when the capsules are reloaded (an edit made elsewhere)",
    (call) => {
      const at = inHook(call);
      expect(at).toBeGreaterThan(-1);
      expect(guardBefore(compiled, at)).toMatch(/\bcapsules\b/);
    },
  );

  it("re-runs the search only on its own inputs (not on every state change)", () => {
    const at = inHook("searchCapsules(");
    const guard = guardBefore(compiled, at);
    expect(guard).toMatch(/\bquery\b/);
    expect(guard).toMatch(/\bcapsules\b/);
    expect(guard).not.toMatch(/\bviewMode\b|\bsortKey\b/);
  });
});
