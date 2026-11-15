import type { DatabaseAdapter, User } from '../types.js'
import type { Session } from '../../core/session.js'
import type { ResolvedAuthConfig } from './framework-config.js'
import type { AuthResult } from './operations/core.js'

export * from './operations/core.js'

{{OPERATIONS_OAUTH}}

{{OPERATIONS_TOTP}}

{{OPERATIONS_JWT}}

{{OPERATIONS_GUARDS}}
