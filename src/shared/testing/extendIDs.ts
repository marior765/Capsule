export function extendIDs(existing: Record<string, string>): readonly string[] {
  return Object.values(existing) as readonly string[];
}
