// ============================================================
// Base error — every error in sedim carries a nextAction
// ============================================================

export class SedimError extends Error {
  cause?: unknown
  nextAction: string

  constructor(message: string, nextAction: string, cause?: unknown) {
    super(message)
    this.name = this.constructor.name
    this.nextAction = nextAction
    this.cause = cause
    // fix prototype chain for instanceof checks in transpiled code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ============================================================
// Subclasses — one per domain, each with a sensible default nextAction
// callers can override by passing their own
// ============================================================

export class DetectionError extends SedimError {
  constructor(
    message: string,
    cause?: unknown,
    nextAction = 'Run `sedim doctor` to diagnose the issue.',
  ) {
    super(message, nextAction, cause)
  }
}

export class PlanError extends SedimError {
  constructor(
    message: string,
    cause?: unknown,
    nextAction = 'Run `sedim plan <module>` to inspect the plan before retrying.',
  ) {
    super(message, nextAction, cause)
  }
}

export class ConflictError extends SedimError {
  constructor(
    message: string,
    cause?: unknown,
    nextAction = 'Run `sedim diff <module>` to review conflicts before proceeding.',
  ) {
    super(message, nextAction, cause)
  }
}

export class WriteError extends SedimError {
  constructor(
    message: string,
    cause?: unknown,
    nextAction = 'Check file permissions and try again. No files were partially written.',
  ) {
    super(message, nextAction, cause)
  }
}

export class SessionError extends SedimError {
  constructor(
    message: string,
    cause?: unknown,
    nextAction = 'Run `sedim continue <module>` to resume, or delete .sedim/session.json to start fresh.',
  ) {
    super(message, nextAction, cause)
  }
}

export class RegistryError extends SedimError {
  constructor(
    message: string,
    cause?: unknown,
    nextAction = 'Check your internet connection or set a local registry in sedim.config.ts.',
  ) {
    super(message, nextAction, cause)
  }
}

// ============================================================
// formatError — safely extracts message, cause, nextAction from anything
// because not everything thrown will be a SedimError
// ============================================================

export interface FormattedError {
  message: string
  cause: string
  nextAction: string
}

export function formatError(err: unknown): FormattedError {
  if (err instanceof SedimError) {
    return {
      message: err.message,
      cause: err.cause ? String(err.cause) : 'No additional cause information.',
      nextAction: err.nextAction,
    }
  }

  if (err instanceof Error) {
    return {
      message: err.message,
      cause: err.stack ?? 'No stack trace available.',
      nextAction: 'Run `sedim doctor` for diagnostics.',
    }
  }

  if (typeof err === 'string') {
    return {
      message: err,
      cause: 'No additional cause information.',
      nextAction: 'Run `sedim doctor` for diagnostics.',
    }
  }

  return {
    message: 'An unknown error occurred.',
    cause: JSON.stringify(err, null, 2),
    nextAction: 'Run `sedim doctor` for diagnostics.',
  }
}
