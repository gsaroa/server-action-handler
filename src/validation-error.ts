type IssueLike = { path: (string | number)[]; message: string }

export type ZodErrorLike = Error & { issues: IssueLike[] }

/**
 * Duck-types a Zod (v3 or v4) `ZodError` without importing `zod`, so this
 * package has zero required dependencies. Works because `ZodError` has been
 * `{ name: 'ZodError', issues: { path, message }[] }` since Zod 3.
 */
export function isZodErrorLike(error: unknown): error is ZodErrorLike {
  if (!(error instanceof Error) || error.name !== 'ZodError') return false
  const issues = (error as { issues?: unknown }).issues
  return (
    Array.isArray(issues) &&
    issues.every(
      (issue) =>
        typeof issue === 'object' &&
        issue !== null &&
        Array.isArray((issue as IssueLike).path) &&
        typeof (issue as IssueLike).message === 'string'
    )
  )
}

/**
 * Flattens Zod-shaped issues into a `{ field: messages[] }` map, mirroring
 * `z.flattenError(error).fieldErrors`. Issues with an empty path (form-level
 * errors, e.g. from `z.refine` at the top level) are grouped under `_root`.
 */
export function flattenIssues(issues: IssueLike[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_root'
    if (!fieldErrors[key]) fieldErrors[key] = []
    fieldErrors[key].push(issue.message)
  }
  return fieldErrors
}
