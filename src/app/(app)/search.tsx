import { router } from "expo-router";
import { useDb } from "@/app/providers";
import { CommandPalette } from "@/widgets/CommandPalette";

/**
 * The command palette (8.6). A screen on the outer stack in
 * `(app)/_layout.tsx`, not a tab — opened from the Home tab's search
 * trigger. Deliberately
 * thin — every real decision (what commands exist, how results are
 * filtered and ranked, how a selection navigates) lives in
 * `widgets/CommandPalette`, per this app's "routes carry no business
 * logic" convention.
 */
export default function SearchScreen() {
  const db = useDb();
  return <CommandPalette db={db} onClose={() => router.back()} />;
}
