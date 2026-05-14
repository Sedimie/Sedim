import path from 'node:path'
import { writeText, exists, readText } from '../shared/fs'
import { SEDIM_LATEST_LOG } from '../shared/constants'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

// appends a line to .sedim/logs/latest.log
// never throws — logging failures should never crash the CLI
export async function log(
  projectRoot: string,
  level: LogLevel,
  message: string,
  data?: unknown
): Promise<void> {
  try {
    const logPath = path.join(projectRoot, SEDIM_LATEST_LOG)
    const timestamp = new Date().toISOString()
    const dataStr = data ? ` ${JSON.stringify(data)}` : ''
    const line = `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}${dataStr}\n`

    const existing = (await exists(logPath)) ? await readText(logPath) : ''
    await writeText(logPath, existing + line)
  } catch {
    // intentionally silent — log failures must not crash the CLI
  }
}

export const logger = {
  info:  (root: string, msg: string, data?: unknown) => log(root, 'info', msg, data),
  warn:  (root: string, msg: string, data?: unknown) => log(root, 'warn', msg, data),
  error: (root: string, msg: string, data?: unknown) => log(root, 'error', msg, data),
  debug: (root: string, msg: string, data?: unknown) => log(root, 'debug', msg, data),
}
