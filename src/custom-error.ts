import { toSnakeCase } from './to-snake-case'
import type { ActionError, ActionResult } from './types'

function isDevelopment(): boolean {
  try {
    return (
      typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
    )
  } catch {
    return false
  }
}

export type CustomErrorOptions = {
  /** The original error or value this error wraps, e.g. a caught DB error. */
  cause?: unknown
  /** The form field this error applies to, if any. */
  field?: string
  /** Machine-readable error code. Defaults to a snake_case version of the class name. */
  code?: string
  /** Arbitrary structured detail to attach to the error response. */
  meta?: unknown
  /**
   * Whether `toJSON()`/`toResult()` include `cause` in their output.
   * Defaults to `true` only when `NODE_ENV === 'development'`, since a cause
   * can leak implementation details (stack traces, raw DB errors) to clients.
   */
  exposeCause?: boolean
}

/**
 * Base class for application-specific errors that should be reported back to
 * the client as a structured, serializable response rather than a generic
 * 500. Extend this for domain-specific errors.
 *
 * @example
 * throw new CustomError('Not found', 404)
 *
 * @example
 * class InsufficientCreditError extends CustomError {
 *   constructor(available: number) {
 *     super('Not enough credits for this action.', 402, { meta: { available } })
 *   }
 * }
 */
export class CustomError extends Error {
  public readonly statusCode: number
  public readonly field?: string
  public readonly code: string
  public readonly meta?: unknown
  private readonly exposeCause: boolean

  constructor(
    message: string,
    statusCode: number,
    options?: CustomErrorOptions
  ) {
    super(message, { cause: options?.cause })

    // Maintain the prototype chain so `instanceof` works for subclasses
    // even after being caught across a compiled/minified boundary.
    Object.setPrototypeOf(this, new.target.prototype)

    this.name = this.constructor.name
    this.statusCode = statusCode
    this.field = options?.field
    this.meta = options?.meta
    this.code = options?.code ?? toSnakeCase(this.name.replace(/Error$/, ''))
    this.exposeCause = options?.exposeCause ?? isDevelopment()
  }

  /**
   * Serializes the error into the `ActionError` shape.
   */
  toJSON(): ActionError {
    const json: ActionError = {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
    }

    if (this.field) json.field = this.field
    if (this.meta) json.meta = this.meta

    if (this.cause && this.exposeCause) {
      if (this.cause instanceof Error) {
        json.cause = this.cause.stack || this.cause.message
      } else if (typeof this.cause === 'object') {
        try {
          json.cause = JSON.stringify(this.cause)
        } catch {
          json.cause = '[Circular or unserializable object]'
        }
      } else {
        json.cause = String(this.cause)
      }
    }

    return json
  }

  /**
   * Formats the error as a failed `ActionResult`, ready to return directly
   * from a server action.
   */
  toResult<TData = null, TMeta = unknown>(): ActionResult<TData, TMeta> {
    return {
      success: false,
      error: this.toJSON() as ActionError<TMeta>,
    }
  }
}
