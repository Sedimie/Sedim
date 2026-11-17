import * as clack from '@clack/prompts'
import chalk from 'chalk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type DoctorCheck, showDoctorReport, showError } from '../../src/showbaby/errors'
import { showBanner, showCancel, showIntro, showOutro } from '../../src/showbaby/intro'
import { DetectionError, SedimError, formatError } from '../../src/shared/errors'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  log: {
    error: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
}))

describe('showbaby terminal formatting & error reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('showError', () => {
    it('formats SedimError with message, cause and next step note', () => {
      const err = new SedimError(
        'Database connection failed',
        'Verify your DATABASE_URL in .env',
        'ECONNREFUSED 127.0.0.1:5432',
      )

      showError(err)

      expect(clack.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed'),
      )
      expect(clack.log.message).toHaveBeenCalledWith(
        expect.stringContaining('ECONNREFUSED 127.0.0.1:5432'),
      )
      expect(clack.note).toHaveBeenCalledWith(
        'Verify your DATABASE_URL in .env',
        expect.stringContaining('next step'),
      )
    })

    it('formats standard Error instance', () => {
      const err = new Error('Unexpected parse error')
      showError(err)

      expect(clack.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected parse error'),
      )
      expect(clack.note).toHaveBeenCalledWith(
        'Run `sedim doctor` for diagnostics.',
        expect.stringContaining('next step'),
      )
    })

    it('formats string error', () => {
      showError('Simple error string')

      expect(clack.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Simple error string'),
      )
    })

    it('formats plain object with message property', () => {
      showError({ message: 'Custom API error', cause: 'Rate limited 429' })

      expect(clack.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Custom API error'),
      )
      expect(clack.log.message).toHaveBeenCalledWith(
        expect.stringContaining('Rate limited 429'),
      )
    })
  })

  describe('showDoctorReport', () => {
    it('renders pass, warn, and fail checks with formatted icons and fixes', () => {
      const checks: DoctorCheck[] = [
        { name: 'Node.js Version', status: 'pass', message: 'v20.0.0 (required: >=18)' },
        {
          name: 'ORM Client',
          status: 'warn',
          message: 'prisma schema not generated',
          fix: 'pnpm prisma generate',
        },
        {
          name: 'Dependencies',
          status: 'fail',
          message: 'better-auth is missing',
          fix: 'pnpm add better-auth',
        },
      ]

      showDoctorReport(checks)

      expect(clack.note).toHaveBeenCalledTimes(1)
      const reportOutput = vi.mocked(clack.note).mock.calls[0][0]
      expect(reportOutput).toContain('Node.js Version')
      expect(reportOutput).toContain('ORM Client')
      expect(reportOutput).toContain('Dependencies')
      expect(reportOutput).toContain('fix: pnpm prisma generate')
      expect(reportOutput).toContain('fix: pnpm add better-auth')
    })
  })

  describe('showIntro & showOutro & showCancel', () => {
    it('calls clack.intro with formatted command banner', () => {
      showIntro('add auth')
      expect(clack.intro).toHaveBeenCalledWith(expect.stringContaining('sedim'))
      expect(clack.log.message).toHaveBeenCalledWith(
        expect.stringContaining('install complete features, not dependencies'),
      )
    })

    it('calls clack.outro with success message', () => {
      showOutro('Module auth installed successfully!')
      expect(clack.outro).toHaveBeenCalledWith(
        expect.stringContaining('Module auth installed successfully!'),
      )
    })

    it('handles showCancel by logging cancellation and exiting process', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
      showCancel('Operation aborted by user')
      expect(clack.cancel).toHaveBeenCalledWith(
        expect.stringContaining('Operation aborted by user'),
      )
      expect(exitSpy).toHaveBeenCalledWith(0)
      exitSpy.mockRestore()
    })
  })

  describe('showBanner', () => {
    it('logs ASCII banner and command tag', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      showBanner('init')
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
