// Tests for step 10.9 — written before implementation (TDD)
//
// Found in the simulator: headers and back buttons showed raw route names —
// "index", "[id]", "[id]/edit", "new", "ephemeral", "inference", "privacy",
// "import-export". A Stack shows a screen's route name unless that screen is
// given a title. Static guard: every screen of every stack under (app) is
// declared with a human title, and back buttons never show a route name.
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const APP = join(__dirname, "../../../app/(app)");

/** Route names a stack layout in `dir` would register (relative, no extension). */
function routeNames(dir: string, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (existsLayout(path)) return []; // its own navigator
      return routeNames(path, `${prefix}${name}/`);
    }
    if (!name.endsWith(".tsx") || name === "_layout.tsx") return [];
    return [`${prefix}${name.replace(/\.tsx$/, "")}`];
  });
}

function existsLayout(dir: string): boolean {
  return readdirSync(dir).includes("_layout.tsx");
}

/** `name` → title for every <Stack.Screen name="…" options={{ … title: "…" }}>. */
function declaredTitles(layout: string): Map<string, string> {
  const titles = new Map<string, string>();
  for (const m of layout.matchAll(
    /<Stack\.Screen\s+name="([^"]+)"\s+options=\{\{([^}]*)\}\}/g,
  )) {
    const title = /title:\s*"([^"]+)"/.exec(m[2]);
    if (title) titles.set(m[1], title[1]);
  }
  return titles;
}

describe.each([["(tabs)/chat"], ["(tabs)/capsules"], ["(tabs)/settings"]])(
  "%s stack",
  (stackDir) => {
    const dir = join(APP, stackDir);
    const layout = readFileSync(join(dir, "_layout.tsx"), "utf8");
    const titles = declaredTitles(layout);

    it.each(routeNames(dir))("titles the %s screen for people", (route) => {
      const title = titles.get(route);
      expect(title).toBeDefined();
      // Not a route name in disguise.
      expect(title).not.toMatch(/^(index|new|edit|\[.*\]|[a-z-]+)$/);
    });

    it("never labels a back button with a route name", () => {
      expect(layout).toMatch(/headerBackButtonDisplayMode:\s*"minimal"/);
    });
  },
);
