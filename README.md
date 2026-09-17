# server-action-handler

Wrap a Next.js Server Action (or any async function whose result crosses a serialization boundary) so it **never throws** — every outcome, success or failure, comes back as a typed `ActionResult<TData>` your client code can switch on.

```ts
const updateEmail = actionHandler('updateEmail', async (userId: string, email: string) => {
  const user = await db.user.update({ where: { id: userId }, data: { email } })
  return user
})
```

```ts
const result = await updateEmail(userId, email)
if (!result.success) {
  form.setError('email', { message: result.error.message })
  return
}
toast.success(result.message)
```

That's it. No `try`/`catch` in the caller, no guessing whether a given action returns `null`, throws, or resolves with `{ error }`.

## The problem

Server Actions run on the server but their return value is serialized straight to the client, which creates two problems every non-trivial app runs into:

```ts
'use server'

export async function updateEmail(userId: string, email: string) {
  const parsed = emailSchema.parse(email) // throws ZodError
  const user = await db.user.update({ where: { id: userId }, data: { email: parsed } })
  return user
}
```

1. **An uncaught throw becomes an opaque framework error on the client** — no message, no status code, no field to attach to a form. You end up wrapping every action in the same `try { ... } catch (error) { return { success: false, error: ... } }` block, by hand, slightly differently each time.
2. **Every action invents its own response shape.** One returns the row directly, another returns `{ data }`, a third returns `{ error: string }` on failure and the raw value on success. Client code ends up with a different unwrapping pattern per call site.

`server-action-handler` wraps the action once and standardizes both: thrown errors are caught and classified, and every outcome comes back as the same `ActionResult<TData>` union.

```ts
import { actionHandler } from 'server-action-handler'

export const updateEmail = actionHandler(
  'updateEmail',
  async (userId: string, email: string) => {
    const parsed = emailSchema.parse(email) // ZodError -> 422 validation_error, automatically
    return db.user.update({ where: { id: userId }, data: { email: parsed } })
  }
)
```

```ts
type ActionResult<TData> =
  | { success: true; data: TData; message: string }
  | { success: false; error: { message: string; statusCode: number; code: string; field?: string; meta?: unknown } }
```

## Typed domain errors with `CustomError`

Throwing a plain `Error` still works (it becomes a generic 500 so internals never leak to the client), but for errors you want the client to actually handle — insufficient credit, a taken slug, a locked resource — extend `CustomError`:

```ts
import { CustomError, actionHandler } from 'server-action-handler'

class SlugTakenError extends CustomError {
  constructor(slug: string) {
    super(`"${slug}" is already in use.`, 409, { field: 'slug' })
  }
}

export const createPost = actionHandler('createPost', async (input: PostInput) => {
  if (await db.post.findUnique({ where: { slug: input.slug } })) {
    throw new SlugTakenError(input.slug)
  }
  return db.post.create({ data: input })
})
```

```ts
const result = await createPost(input)
if (!result.success) {
  // result.error.code === 'slug_taken' (inferred from the class name)
  // result.error.field === 'slug'
  // result.error.statusCode === 409
}
```

`code` is inferred from the class name (`SlugTakenError` → `slug_taken`) unless you pass one explicitly. `cause` is included in the serialized error only when `NODE_ENV === 'development'`, so a wrapped DB error's stack trace never reaches production clients by default.

## Zod, without a hard dependency

If the action throws a `ZodError` (e.g. from `schema.parse(...)`), it's automatically mapped to a `422 validation_error` with `meta.details` as a `{ field: message[] }` map — the shape most form libraries want for `setError` loops. This works by duck-typing `{ name: 'ZodError', issues }`, so **this package has zero required dependencies**; you don't need `zod` installed for the rest of the library to work, and it doesn't pin a `zod` version alongside yours.

Using a different validator? Override the detector and formatter:

```ts
actionHandler('signup', action, {
  isValidationError: (error) => error instanceof MyValidationError,
  formatValidationError: (error) => ({ message: error.message, meta: { details: error.fields } }),
})
```

## Logging

By default, unexpected errors are logged with `console.error`. Point it at your own logger/error tracker with `onError`, and redact what gets logged with `sanitizeArgs` (it already truncates long strings, summarizes `Buffer`s, and collapses objects by default, so payloads and secrets don't end up verbatim in your logs):

```ts
actionHandler('updateEmail', action, {
  onError: ({ actionName, message, error, args }) => {
    logger.error({ actionName, args }, message, error)
  },
})
```

## vs. next-safe-action

[`next-safe-action`](https://next-safe-action.dev) is the fuller-featured option if you want schema-validated *input* (client and server), middleware chains, and typed hooks — it's a framework of its own. `server-action-handler` does one thing: it standardizes the *output* of an action you've already written, with no client-side hook, no middleware system, and no required dependency on any validation library. Reach for this when you already have (or don't need) input validation and just want every action to return the same shape without a `try`/`catch` in every file.

## Install

```sh
npm install server-action-handler
```

## API

- **`actionHandler(actionName, action, options?)`** — wraps an async function. `action` may return the data directly, or `{ data, message }` to set a custom success message.
- **`CustomError`** — base class for domain errors. `new CustomError(message, statusCode, { field?, code?, meta?, cause?, exposeCause? })`.
- **`ActionResult<TData, TMeta>`**, **`ActionError<TMeta>`**, **`ActionSuccess<TData>`** — the response types.
- **`isZodErrorLike`**, **`flattenIssues`** — the Zod duck-typing helpers, exported in case you want them outside `actionHandler`.

## License

MIT
