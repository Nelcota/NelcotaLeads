/** A form checked in the browser: the value to send, or the first problem in words. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** The first validation message, for a form that shows one problem at a time. */
export function firstIssue(issues: readonly { message: string }[]): string {
  return issues[0]?.message ?? "Confira os campos.";
}
