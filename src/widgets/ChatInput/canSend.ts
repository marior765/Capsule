/** Whether Send should be enabled: there's non-whitespace text and input isn't disabled. */
export function canSend(text: string, disabled: boolean): boolean {
  return !disabled && text.trim().length > 0;
}
