# server-action-handler

## 0.1.0

Initial release.

- `actionHandler(actionName, action, options?)` — wraps an async function (a Next.js Server Action, an RPC handler, or any async function whose result crosses a serialization boundary) so every outcome comes back as a typed `ActionResult<TData>`.
- `CustomError` — base class for typed domain errors, with snake_case `code` inference from the class name and dev-only `cause` exposure.
- Automatic `ZodError` handling (duck-typed — no required `zod` dependency) mapping to a `422 validation_error` with `meta.details` as a `{ field: message[] }` map.
- Pluggable `onError`, `sanitizeArgs`, `isValidationError`, and `formatValidationError` options for custom logging and non-Zod validators.
