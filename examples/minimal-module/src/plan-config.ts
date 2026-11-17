import type { DetectedContext, PlanConfig } from '@sedim/core'

/**
 * Minimal Example Module: Health Check
 * Demonstrates a complete, compliant implementation of the module-author contract.
 */
export function createHealthPlanConfig(
  ctx: DetectedContext,
  selectedFeatures: string[] = [],
): PlanConfig {
  const src = ctx.structure.srcDir ?? 'src'
  const targetDir = `${src}/sedim/health`
  const framework = ctx.framework.value

  const templates: PlanConfig['templates'] = [
    {
      templateKey: 'health/health-check',
      outputPath: () => `${targetDir}/health-check.ts`,
      overwriteStrategy: 'skip',
    },
  ]

  const injections: PlanConfig['injections'] = []

  // If Express or Fastify entrypoint is detected, inject health route mounting
  if (framework === 'express') {
    injections.push({
      type: 'import',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        express: {
          payload: `import { healthHandler } from './sedim/health/health-check'`,
          anchor: `import`,
          position: 'after',
        },
      },
    })
    injections.push({
      type: 'route',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        express: {
          payload: `app.get('/health', healthHandler)`,
          anchor: `app.listen`,
          position: 'before',
        },
      },
    })
  }

  return {
    moduleName: 'health',
    version: '1.0.0',
    templates,
    injections,
    dependencies: [],
    devDependencies: [],
    envVars: [],
    schemaTables: [],
    peerContracts: [],
  }
}
