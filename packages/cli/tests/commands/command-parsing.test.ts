import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createProgram } from '../../src/index'

describe('CLI command arguments parsing', () => {
  it('registers all top-level commands and options', () => {
    const program = createProgram()

    expect(program.name()).toBe('sedim')
    const commandNames = program.commands.map(cmd => cmd.name())
    expect(commandNames).toContain('init')
    expect(commandNames).toContain('add')
    expect(commandNames).toContain('continue')
    expect(commandNames).toContain('doctor')
    expect(commandNames).toContain('plan')
    expect(commandNames).toContain('diff')
  })

  it('parses global --cwd option', () => {
    const program = createProgram()
    program.exitOverride()

    program.parse(['node', 'sedim', '--cwd', './apps/web', 'doctor'])
    expect(program.opts().cwd).toBe('./apps/web')
  })

  it('parses "init" options (-f, --force)', () => {
    const program = createProgram()
    program.exitOverride()

    const initCmd = program.commands.find(c => c.name() === 'init')!
    expect(initCmd.options.map(o => o.long)).toContain('--force')
  })

  it('parses "add" arguments and flags (--dry-run, --force)', () => {
    const program = createProgram()
    program.exitOverride()

    const addCmd = program.commands.find(c => c.name() === 'add')!
    expect(addCmd.options.map(o => o.long)).toContain('--dry-run')
    expect(addCmd.options.map(o => o.long)).toContain('--force')

    // Parse mock arguments
    program.parse(['node', 'sedim', 'add', 'auth', '--dry-run', '--force'])
    const addActionOpts = addCmd.opts()
    expect(addActionOpts.dryRun).toBe(true)
    expect(addActionOpts.force).toBe(true)
  })

  it('parses "continue" with optional module argument', () => {
    const program = createProgram()
    const continueCmd = program.commands.find(c => c.name() === 'continue')!
    expect(continueCmd.registeredArguments[0].required).toBe(false)
  })

  it('parses "plan" and "diff" with required module argument', () => {
    const program = createProgram()
    const planCmd = program.commands.find(c => c.name() === 'plan')!
    const diffCmd = program.commands.find(c => c.name() === 'diff')!
    expect(planCmd.registeredArguments[0].required).toBe(true)
    expect(diffCmd.registeredArguments[0].required).toBe(true)
  })
})
