import * as clack from '@clack/prompts'
import { showCancel } from './intro'

// ============================================================
// handleCancel — called after every prompt
// if user hit ctrl+c, bail cleanly
// ============================================================

export function handleCancel(value: unknown): void {
  if (clack.isCancel(value)) showCancel()
}

// ============================================================
// Prompt wrappers — each calls handleCancel internally
// callers never have to think about the cancel pattern
// ============================================================

export async function confirm(message: string, initialValue = false): Promise<boolean> {
  const result = await clack.confirm({ message, initialValue })
  handleCancel(result)
  return result as boolean
}

export async function select<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>
): Promise<T> {
  const result = await clack.select({ message, options })
  handleCancel(result)
  return result as T
}

export async function multiselect<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>,
  required = true
): Promise<T[]> {
  const result = await clack.multiselect({ message, options, required })
  handleCancel(result)
  return result as T[]
}

export async function text(
  message: string,
  placeholder?: string,
  validate?: (value: string | undefined) => string | Error | undefined
): Promise<string> {
  const result = await clack.text({ message, placeholder, validate })
  handleCancel(result)
  return result as string
}
