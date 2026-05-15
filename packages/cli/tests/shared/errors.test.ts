import { describe, expect, it } from 'vitest'
import {
  SedimError,
  DetectionError,
  PlanError,
  ConflictError,
  WriteError,
  SessionError,
  RegistryError,
  formatError,
} from '../../src/shared/errors'

describe('SedimError', () => {
  it('sets name to the subclass name', () => {
    const err = new DetectionError('test')
    expect(err.name).toBe('DetectionError')
  })

  it('instanceof works correctly through prototype chain fix', () => {
    const err = new WriteError('test')
    expect(err instanceof WriteError).toBe(true)
    expect(err instanceof SedimError).toBe(true)
    expect(err instanceof Error).toBe(true)
  })

  it('carries nextAction with default value', () => {
    const err = new DetectionError('something broke')
    expect(err.nextAction).toContain('sedim doctor')
  })

  it('allows overriding nextAction', () => {
    const err = new DetectionError('something broke', undefined, 'custom next action')
    expect(err.nextAction).toBe('custom next action')
  })

  it('carries cause', () => {
    const cause = new Error('original error')
    const err = new WriteError('wrapper', cause)
    expect(err.cause).toBe(cause)
  })

  it('each subclass has the right default nextAction', () => {
    expect(new DetectionError('x').nextAction).toContain('doctor')
    expect(new PlanError('x').nextAction).toContain('plan')
    expect(new ConflictError('x').nextAction).toContain('diff')
    expect(new WriteError('x').nextAction).toContain('permissions')
    expect(new SessionError('x').nextAction).toContain('continue')
    expect(new RegistryError('x').nextAction).toContain('internet')
  })
})

describe('formatError', () => {
  it('handles SedimError — extracts all three fields', () => {
    const err = new WriteError('could not write file', new Error('EACCES'), 'check permissions')
    const result = formatError(err)

    expect(result.message).toBe('could not write file')
    expect(result.cause).toContain('EACCES')
    expect(result.nextAction).toBe('check permissions')
  })

  it('handles SedimError with no cause', () => {
    const err = new DetectionError('no framework found')
    const result = formatError(err)

    expect(result.message).toBe('no framework found')
    expect(result.cause).toBe('No additional cause information.')
  })

  it('handles plain Error — uses stack as cause', () => {
    const err = new Error('plain error')
    const result = formatError(err)

    expect(result.message).toBe('plain error')
    expect(result.cause).toContain('plain error') // stack includes message
    expect(result.nextAction).toContain('doctor')
  })

  it('handles string', () => {
    const result = formatError('something went wrong')

    expect(result.message).toBe('something went wrong')
    expect(result.cause).toBe('No additional cause information.')
    expect(result.nextAction).toContain('doctor')
  })

  it('handles unknown object', () => {
    const result = formatError({ code: 42, detail: 'weird error' })

    expect(result.message).toBe('An unknown error occurred.')
    expect(result.cause).toContain('42')
    expect(result.nextAction).toContain('doctor')
  })

  it('handles null', () => {
    const result = formatError(null)
    expect(result.message).toBe('An unknown error occurred.')
  })
})
