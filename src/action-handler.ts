import { CustomError } from './custom-error'
import type { ActionResult } from './types'
import {
  flattenIssues,
  isZodErrorLike,
  type ZodErrorLike,
} from './validation-error'

export type ActionErrorContext<TArgs extends unknown[]> = {
  actionName: string
  message: string
  error: unknown
  args: TArgs
}

export type ActionHandlerOptions<TArgs extends unknown[]> = {
  /**
   * Called once per failed run, after the error has been classified, so you
   * can send it to your own logger/error tracker. Defaults to
   * `console.error`. Not called for validation errors unless you want it to
   * be — override `isValidationError`/`formatValidationError` for that.
   */
  onError?: (context: ActionErrorContext<TArgs>) => void
  /**
   * Redacts arguments before they're passed to `onError`, so large payloads,
   * buffers, and nested objects don't end up in your logs. Defaults to
   * truncating long strings, summarizing `Buffer`s, and collapsing objects
   * to `'[Object]'`.
   */
  sanitizeArgs?: (args: TArgs) => unknown[]
  /**
   * Identifies errors that should map to a 422 `validation_error` response
   * instead of a generic 500. Defaults to duck-typing a Zod `ZodError`
   * (works without a `zod` dependency).
   */
  isValidationError?: (error: unknown) => boolean
  /**
   * Formats a validation error (as identified by `isValidationError`) into
   * the failure's `message` and `meta`. Defaults to Zod's
   * `{ details: { field: messages[] } }` shape.
   */
  formatValidationError?: (error: unknown) => {
    message: string
    meta?: unknown
  }
}

function defaultSanitizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string' && arg.length > 200) {
      return `[String too large to log: ${arg.length} chars]`
    }
    if (typeof Buffer !== 'undefined' && arg instanceof Buffer) {
      return `[Buffer: ${arg.length} bytes]`
    }
    if (typeof arg === 'object' && arg !== null) return '[Object]'
    return arg
  })
}

function defaultFormatValidationError(error: unknown): {
  message: string
  meta?: unknown
} {
  const { issues } = error as ZodErrorLike
  return {
    message: issues[0]?.message ?? 'Invalid data provided.',
    meta: { details: flattenIssues(issues) },
  }
}

function isSuccessShorthand<TData>(
  result: unknown
): result is { data: TData; message: string } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'data' in result &&
    'message' in result
  )
}

/**
 * Wraps an async function (a Next.js Server Action, an RPC handler, or any
 * async function whose result crosses a serialization boundary) so it never
 * throws: every outcome, success or failure, comes back as a typed,
 * serializable `ActionResult`.
 *
 * @param actionName Used in the default success message and in `onError`/log output.
 * @param action The function containing the actual logic. Return the data
 *   directly, or `{ data, message }` to customize the success message.
 */
export function actionHandler<TArgs extends unknown[], TData = null>(
  actionName: string,
  action: (...args: TArgs) => Promise<TData | { data: TData; message: string }>,
  options: ActionHandlerOptions<TArgs> = {}
): (...args: TArgs) => Promise<ActionResult<TData>> {
  const {
    onError = ({ actionName, message, error }) =>
      console.error(`[${actionName}]`, message, error),
    sanitizeArgs = defaultSanitizeArgs,
    isValidationError = isZodErrorLike,
    formatValidationError = defaultFormatValidationError,
  } = options

  return async (...args: TArgs): Promise<ActionResult<TData>> => {
    try {
      const result = await action(...args)
      if (isSuccessShorthand<TData>(result)) {
        return { success: true, data: result.data, message: result.message }
      }
      return {
        success: true,
        data: result as TData,
        message: `Action '${actionName}' completed successfully.`,
      }
    } catch (error: unknown) {
      const sanitizedArgs = sanitizeArgs(args) as TArgs

      if (isValidationError(error)) {
        const { message, meta } = formatValidationError(error)
        onError({
          actionName,
          message: 'Validation error',
          error,
          args: sanitizedArgs,
        })
        return {
          success: false,
          error: { message, statusCode: 422, code: 'validation_error', meta },
        }
      }

      if (error instanceof CustomError) {
        onError({
          actionName,
          message: error.message,
          error,
          args: sanitizedArgs,
        })
        return error.toResult<TData>()
      }

      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred.'

      onError({
        actionName,
        message,
        error,
        args: sanitizedArgs,
      })

      return {
        success: false,
        error: {
          message: 'An internal server error occurred. Please try again.',
          statusCode: 500,
          code: 'internal_server_error',
        },
      }
    }
  }
}
