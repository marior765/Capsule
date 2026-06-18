export function buildTestID(
  prefix: string,
  component: string,
  element: string
): string {
  return `${prefix}_${component}_${element}`;
}
