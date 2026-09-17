/**
 * Converts camelCase, PascalCase, or kebab-case to snake_case. Used to infer
 * an error `code` from a `CustomError` subclass name (e.g. `EmailSendError`
 * -> `email_send`) when no explicit `code` is given.
 */
export function toSnakeCase(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}
