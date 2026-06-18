import { buildTestID } from "./buildTestID";

export const CATEGORY_PREFIXES = {
  buttons: "btn",
  inputs: "input",
  labels: "lbl",
  texts: "text",
  icons: "icon",
  images: "img",
  containers: "container",
  pressables: "pressable",
  headers: "header",
  dialogs: "dialog",
  sheets: "sheet",
} as const;

type Category = keyof typeof CATEGORY_PREFIXES;
type ElementMap = Partial<Record<Category, readonly string[]>>;
type MappedCategory<T extends readonly string[]> = { [K in T[number]]: string };
type MappedTestIDs<T extends ElementMap> = {
  [K in keyof T]: T[K] extends readonly string[]
    ? MappedCategory<T[K]>
    : never;
};

export function createComponentTestIDs<T extends ElementMap>(
  componentName: string,
  categories: T
): MappedTestIDs<T> {
  const result = {} as MappedTestIDs<T>;

  for (const category in categories) {
    const elements = categories[category as Category];
    if (!elements) continue;

    const prefix = CATEGORY_PREFIXES[category as Category];
    const mapped = {} as Record<string, string>;

    for (const element of elements) {
      mapped[element] = buildTestID(prefix, componentName, element);
    }

    (result as Record<string, unknown>)[category] = mapped;
  }

  return result;
}
