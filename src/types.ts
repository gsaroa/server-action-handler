/**
 * An error returned from an action.
 */
export type ActionError<TMeta = unknown> = {
  message: string
  statusCode: number
  code: string
  field?: string
  meta?: TMeta
  cause?: unknown
}

/**
 * A successful action result.
 */
export type ActionSuccess<TData> = {
  data: TData
  message?: string
}

/**
 * The result of a wrapped action: either a success with data, or a failure
 * with a structured, serializable error.
 */
export type ActionResult<TData = null, TMeta = unknown> =
  | ({ success: true } & ActionSuccess<TData>)
  | { success: false; error: ActionError<TMeta> }
