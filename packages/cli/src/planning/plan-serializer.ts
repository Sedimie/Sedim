import type { InstallPlan } from './types'

// serializes an InstallPlan to JSON string for session persistence
export function serializePlan(plan: InstallPlan): string {
  return JSON.stringify(plan, null, 2)
}

// deserializes a plan from session JSON
// validates the shape minimally — enough to catch corrupt sessions
export function deserializePlan(raw: string): InstallPlan {
  const parsed = JSON.parse(raw) as InstallPlan

  if (!parsed.moduleName || !Array.isArray(parsed.filesToCreate)) {
    throw new Error('Invalid plan shape in session — session may be corrupt')
  }

  return parsed
}
