export function getInputTestId(baseId: string): {
  input: string;
  focus: string;
  clear: string;
} {
  return {
    input: baseId,
    focus: `${baseId}Focus`,
    clear: `${baseId}Clear`,
  };
}
