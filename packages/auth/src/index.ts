// @sedim/auth — public API
// This is what gets imported when someone does: import { ... } from '@sedim/auth'
// The stamped code in user projects imports from relative paths, not this package.

export * from './core/index.js'
export * from './adapters/index.js'
export { createAuthPlanConfig } from './plan-config.js'
