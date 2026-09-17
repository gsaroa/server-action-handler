import { describe, expect, it } from 'vitest'
import { CustomError } from '../src/custom-error'

describe('CustomError', () => {
  it('infers a snake_case code from the class name', () => {
    class InsufficientCreditError extends CustomError {
      constructor() {
        super('Not enough credits.', 402)
      }
    }

    const error = new InsufficientCreditError()
    expect(error.code).toBe('insufficient_credit')
    expect(error.statusCode).toBe(402)
  })

  it('uses an explicit code over the inferred one', () => {
    const error = new CustomError('Nope', 403, { code: 'forbidden' })
    expect(error.code).toBe('forbidden')
  })

  it('serializes to the ActionError shape via toJSON', () => {
    const error = new CustomError('Bad field', 422, { field: 'email' })
    const json = error.toJSON()
    expect(json).toEqual({
      message: 'Bad field',
      statusCode: 422,
      code: 'custom',
      field: 'email',
    })
  })

  it('includes meta when provided', () => {
    const error = new CustomError('Rate limited', 429, {
      meta: { retryAfterMs: 5000 },
    })
    expect(error.toJSON().meta).toEqual({ retryAfterMs: 5000 })
  })

  it('omits cause by default', () => {
    const error = new CustomError('Boom', 500, { cause: new Error('inner') })
    expect(error.toJSON().cause).toBeUndefined()
  })

  it('includes cause when exposeCause is true', () => {
    const inner = new Error('db timeout')
    const error = new CustomError('Boom', 500, {
      cause: inner,
      exposeCause: true,
    })
    expect(error.toJSON().cause).toContain('db timeout')
  })

  it('stringifies a non-Error object cause when exposed', () => {
    const error = new CustomError('Boom', 500, {
      cause: { reason: 'timeout' },
      exposeCause: true,
    })
    expect(error.toJSON().cause).toBe('{"reason":"timeout"}')
  })

  it('produces a failed ActionResult via toResult', () => {
    const error = new CustomError('Nope', 404, { code: 'not_found' })
    expect(error.toResult()).toEqual({
      success: false,
      error: { message: 'Nope', statusCode: 404, code: 'not_found' },
    })
  })

  it('preserves instanceof across subclasses', () => {
    class AuthError extends CustomError {
      constructor() {
        super('Unauthorized', 401)
      }
    }
    const error: unknown = new AuthError()
    expect(error).toBeInstanceOf(AuthError)
    expect(error).toBeInstanceOf(CustomError)
    expect(error).toBeInstanceOf(Error)
  })
})
