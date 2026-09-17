import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { actionHandler } from '../src/action-handler'
import { CustomError } from '../src/custom-error'

describe('actionHandler', () => {
  it('returns a success envelope with a default message', async () => {
    const action = actionHandler('createUser', async (name: string) => ({
      id: 1,
      name,
    }))

    const result = await action('Ada')
    expect(result).toEqual({
      success: true,
      data: { id: 1, name: 'Ada' },
      message: "Action 'createUser' completed successfully.",
    })
  })

  it('honors a custom success message via the { data, message } shorthand', async () => {
    const action = actionHandler('createUser', async () => ({
      data: { id: 1 },
      message: 'User created.',
    }))

    const result = await action()
    expect(result).toEqual({
      success: true,
      data: { id: 1 },
      message: 'User created.',
    })
  })

  it('maps a thrown ZodError to a 422 validation_error with flattened fields', async () => {
    const schema = z.object({ email: z.string().email() })
    const action = actionHandler('signup', async () => {
      schema.parse({ email: 'not-an-email' })
      return null
    })

    const result = await action()
    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error.statusCode).toBe(422)
    expect(result.error.code).toBe('validation_error')
    expect(result.error.meta).toMatchObject({
      details: { email: expect.any(Array) },
    })
  })

  it('maps a thrown CustomError via its own toResult', async () => {
    class NotFoundError extends CustomError {
      constructor() {
        super('Not found', 404)
      }
    }
    const action = actionHandler('getUser', async () => {
      throw new NotFoundError()
    })

    const result = await action()
    expect(result).toEqual({
      success: false,
      error: { message: 'Not found', statusCode: 404, code: 'not_found' },
    })
  })

  it('maps an unknown thrown error to a generic 500 without leaking its message', async () => {
    const action = actionHandler('deleteUser', async () => {
      throw new Error('connection string exposed: postgres://...')
    })

    const result = await action()
    expect(result).toEqual({
      success: false,
      error: {
        message: 'An internal server error occurred. Please try again.',
        statusCode: 500,
        code: 'internal_server_error',
      },
    })
  })

  it('calls onError with the sanitized args for an unexpected error', async () => {
    const onError = vi.fn()
    const action = actionHandler(
      'update',
      async (_id: string, _payload: { secret: string }) => {
        throw new Error('boom')
      },
      { onError }
    )

    await action('user-1', { secret: 'x'.repeat(500) })

    expect(onError).toHaveBeenCalledTimes(1)
    const context = onError.mock.calls[0][0]
    expect(context.actionName).toBe('update')
    expect(context.args).toEqual(['user-1', '[Object]'])
  })

  it('truncates long string args in the default sanitizer', async () => {
    const onError = vi.fn()
    const action = actionHandler(
      'echo',
      async (_text: string) => {
        throw new Error('boom')
      },
      { onError }
    )

    await action('y'.repeat(300))

    expect(onError.mock.calls[0][0].args).toEqual([
      '[String too large to log: 300 chars]',
    ])
  })

  it('supports a custom validation error detector and formatter', async () => {
    class ValidationError extends Error {
      constructor(public fields: Record<string, string>) {
        super('Invalid')
      }
    }

    const action = actionHandler(
      'submit',
      async () => {
        throw new ValidationError({ name: 'required' })
      },
      {
        isValidationError: (error) => error instanceof ValidationError,
        formatValidationError: (error) => ({
          message: 'Invalid',
          meta: { details: (error as ValidationError).fields },
        }),
      }
    )

    const result = await action()
    expect(result).toEqual({
      success: false,
      error: {
        message: 'Invalid',
        statusCode: 422,
        code: 'validation_error',
        meta: { details: { name: 'required' } },
      },
    })
  })

  it('does not call onError on success', async () => {
    const onError = vi.fn()
    const action = actionHandler('noop', async () => null, { onError })
    await action()
    expect(onError).not.toHaveBeenCalled()
  })
})
