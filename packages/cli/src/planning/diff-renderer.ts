import type { InstallPlan } from './types'

// returns a plain-text summary of what a plan will do
// used by sedim plan and sedim diff --summary
export function renderPlanSummary(plan: InstallPlan): string {
  const lines: string[] = [`Plan for module: ${plan.moduleName}`, '']

  if (plan.filesToCreate.length) {
    lines.push('Files to create:')
    for (const f of plan.filesToCreate) lines.push(`  + ${f.path}`)
    lines.push('')
  }

  if (plan.filesToModify.length) {
    lines.push('Files to modify:')
    for (const f of plan.filesToModify) lines.push(`  ~ ${f.path} (${f.description})`)
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
    for (const e of plan.envVarsToAdd) lines.push(`  ${e.key} — ${e.description}`)
  }

  if (plan.conflictActions.length) {
    lines.push('Conflicts:')
    for (const c of plan.conflictActions)
      lines.push(`  ! ${c.file} (${c.level}) — ${c.description}`)
  }

  return lines.join('\n')
}
