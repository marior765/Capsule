// Regression guard for 8.12 / 10.40 (one send at a time).
//
// 10.40 asked for the chat input to be disabled for the whole send (capsule
// search + streaming) so a second tap can't start a second completion on the
// same model. Reconciling 10.40 found 8.12 had already built this in both
// chat screens, with no test keeping it in place. The guard lives in the
// route components, which need a model context and a database to render, so
// this reads their source and pins the parts that make the guard work.
import { readFileSync } from "fs";
import { join } from "path";

const chatDir = join(__dirname, "../../../app/(app)/(tabs)/chat");
/** Source with `//` line comments removed, so prose can't match as code. */
const code = (file: string): string =>
  readFileSync(join(chatDir, file), "utf8").replace(/^\s*\/\/.*$/gm, "");

const routes = {
  "saved chat": code("[id].tsx"),
  "ephemeral chat": code("ephemeral.tsx"),
};

/** The body of `const handleSend = …` up to the next top-level `const`. */
function handleSendBody(source: string): string {
  const start = source.indexOf("const handleSend");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("\n  const ", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

describe.each(Object.entries(routes))("%s: one send at a time", (_, source) => {
  const body = handleSendBody(source);

  it("refuses a send while one is in flight, before any await", () => {
    // The ref holds before the `sending` re-render lands.
    expect(source).toMatch(/const sendInFlight = useRef\(false\)/);
    const guard = body.search(/if \([^)]*sendInFlight\.current\) return;/);
    const claim = body.indexOf("sendInFlight.current = true;");
    const firstAwait = body.indexOf("await ");
    expect(guard).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(guard);
    expect(firstAwait).toBeGreaterThan(claim);
  });

  it("marks the send as running before any await, and releases it only in finally", () => {
    expect(body.indexOf("setSending(true)")).toBeLessThan(
      body.indexOf("await "),
    );
    const finallyBlock = body.slice(body.lastIndexOf("} finally {"));
    expect(finallyBlock).toMatch(/setSending\(false\)/);
    expect(finallyBlock).toMatch(/sendInFlight\.current = false/);
    expect(body.match(/setSending\(false\)/g)).toHaveLength(1);
    expect(body.match(/sendInFlight\.current = false/g)).toHaveLength(1);
  });

  it("disables the message input for the whole send", () => {
    // Within the <ChatInput … /> element (its props contain "=>").
    expect(source).toMatch(
      /<ChatInput\b(?:(?!\/>)[\s\S])*disabled=\{sending\}/,
    );
  });
});
