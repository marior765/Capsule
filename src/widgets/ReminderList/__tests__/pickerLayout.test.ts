// Tests for step 10.8 — written before implementation (TDD)
//
// Found in the simulator: in the iOS "Remind me" sheet the Cancel / Set
// reminder buttons covered the inline picker's Time row, so the time could
// not be seen or changed. The combined `mode="datetime"` inline picker
// overflows the height its host measures. Static checks (no render library
// here — see BLOCKED.md): the iOS sheet uses a date calendar plus its own
// time row, and pads for the home indicator.
import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(
  join(__dirname, "../ReminderDateTimePicker.tsx"),
  "utf8",
);
const iosSheet = source.slice(source.indexOf("<Modal"));

/** The opening `<DateTimePicker … />` tag whose mode is `mode`. */
function pickerTag(mode: string): string {
  const start = iosSheet.indexOf(`mode="${mode}"`);
  if (start === -1) return "";
  const open = iosSheet.lastIndexOf("<DateTimePicker", start);
  const close = iosSheet.indexOf("/>", start);
  return iosSheet.slice(open, close + 2);
}

describe("ReminderDateTimePicker iOS sheet (10.8)", () => {
  it("no longer uses the combined inline datetime picker", () => {
    expect(iosSheet).not.toMatch(/mode="datetime"/);
  });

  it("shows an inline date calendar", () => {
    expect(pickerTag("date")).toMatch(/display="inline"/);
  });

  it("shows a separate compact time picker", () => {
    expect(pickerTag("time")).toMatch(/display="compact"/);
  });

  // Found in the simulator: without flex the compact picker's native host
  // collapses to ~0 width and the time spills off-screen.
  it("gives the time picker the rest of its row", () => {
    expect(pickerTag("time")).toMatch(/style=\{styles\.timePicker\}/);
    expect(source).toMatch(/timePicker:\s*\{\s*flex:\s*1/);
  });

  // Reviewer finding: the old combined picker couldn't go into the past; the
  // separate time wheel must keep that limit (SwiftUI compares full dates, so
  // it only limits times on today).
  it("keeps past times out of reach in both pickers", () => {
    expect(pickerTag("date")).toMatch(/minimumDate=\{minimumDate\}/);
    expect(pickerTag("time")).toMatch(/minimumDate=\{minimumDate\}/);
  });

  it("gives both pickers testIDs from the testIDs object", () => {
    expect(pickerTag("date")).toMatch(/testID=\{testIDs\.inputs\.date\}/);
    expect(pickerTag("time")).toMatch(/testID=\{testIDs\.inputs\.time\}/);
    expect(source).toMatch(/inputs:\s*\[\s*"date",\s*"time"\s*\]/);
  });

  it("updates each half of the value with the local-time combiners", () => {
    expect(iosSheet).toMatch(/withLocalDate\(/);
    expect(iosSheet).toMatch(/withLocalTime\(/);
  });

  it("keeps the buttons clear of the home indicator", () => {
    expect(source).toMatch(/useSafeAreaInsets\(\)/);
    expect(source).toMatch(/paddingBottom:[^,}]*insets\.bottom/);
  });
});
