import type { InstallPlan } from './types'

// returns a plain-text summary of what a plan will do
// used by sedim plan and sedim diff --summary
export function renderPlanSummary(plan: InstallPlan): string {
  const lines: string[] = [`Plan for module: ${plan.moduleName}`, '']

  if (plan.filesToCreate.length) {
    lines.push('Files to create:')
    plan.filesToCreate.forEach(f => lines.push(`  + ${f.path}`))
    lines.push('')
  }

  if (plan.filesToModify.length) {
    lines.push('Files to modify:')
    plan.filesToModify.forEach(f => lines.push(`  ~ ${f.path} (${f.description})`))
    lines.push('')
  }

  if (plan.dependenciesToInstall.length) {
    lines.push(`Dependencies: ${plan.dependenciesToInstall.join(', ')}`)
  }

  if (plan.devDependenciesToInstall.length) {
    lines.push(`Dev dependencies: ${plan.devDependenciesToInstall.join(', ')}`)
  }

  if (plan.envVarsToAdd.length) {
    lines.push('Env vars required:')
    plan.envVarsToAdd.forEach(e => lines.push(`  ${e.key} — ${e.description}`))
  }

  if (plan.conflictActions.length) {
    lines.push('Conflicts:')
    plan.conflictActions.forEach(c => lines.push(`  ! ${c.file} (${c.level}) — ${c.description}`))
  }

  return lines.join('\n')
}
