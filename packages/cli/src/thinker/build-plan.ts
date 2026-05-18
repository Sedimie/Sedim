import type {
  DetectedContext,
  FileToCreate,
  FileToModify,
  InjectionAction,
  InjectionType,
  InstallPlan,
  PlanConfig,
} from '../planning/types'
import { PlanError } from '../shared/errors'
import { classifyConflicts } from './classify-conflicts'
import { resolveTemplate } from './resolve-template'

// minimum manifest version the thinker can process
// bump this when PlanConfig or InstallPlan shapes change in a breaking way
const MIN_MANIFEST_VERSION = '0.1.0'

function validateManifestVersion(version: string): void {
  // simple semver major.minor.patch comparison
  // a manifest is valid if its major version matches and minor >= minimum
  const [minMaj, minMin] = MIN_MANIFEST_VERSION.split('.').map(Number)
  const parts = version.split('.')
  if (parts.length < 3) {
    throw new PlanError(
      `Invalid manifest version format: "${version}"`,
      undefined,
      'The module manifest version must follow semver (e.g. 0.1.0).',
    )
  }
  const [maj, min] = parts.map(Number)
  if (maj !== minMaj || min < minMin) {
    throw new PlanError(
      `Manifest version "${version}" is not compatible with this CLI (requires >=${MIN_MANIFEST_VERSION})`,
      undefined,
      'Update sedim to the latest version or check the module registry for a compatible manifest.',
    )
  }
}

// ============================================================
// buildPlan — the generic thinker engine
// takes what the module wants (PlanConfig) and what exists (DetectedContext)
// produces a deterministic InstallPlan — no module knowledge here
// ============================================================

export async function buildPlan(
  ctx: DetectedContext,
  config: PlanConfig,
  selectedFeatures: string[],
): Promise<InstallPlan> {
  // validate manifest version before doing anything
  validateManifestVersion(config.version)

  const framework = ctx.framework.value

  // ── 1. resolve template output paths + content ────────────
  // each template's outputPath is a function — call it with ctx
  // content is resolved from the template registry
  const filesToCreate: FileToCreate[] = await Promise.all(
    config.templates.map(async template => {
      let content: string | undefined
      try {
        content = await resolveTemplate(template.templateKey, ctx, selectedFeatures)
      } catch {
        // template not found — writer will surface this as an error
        // don't fail the whole plan for one missing template
        content = undefined
      }

      // ── strip 'use client' for non-Next.js environments ──────
      if (content && framework !== 'nextjs') {
        content = content.replace(/(^|\n)\s*['"]use client['"];?\s*/g, '$1')
      }

      return {
        path: template.outputPath(ctx),
        templateKey: template.templateKey,
        content,
      }
    }),
  )

  // ── 2. resolve injection targets and anchors ───────────────
  const injectionActions: InjectionAction[] = []
  const filesToModify: FileToModify[] = []
  const unresolvableInjections: string[] = []

  for (const injection of config.injections) {
    // resolve which file to inject into
    const targetFile = injection.target(ctx)
    if (!targetFile) {
      // target function returned null — this injection doesn't apply
      // to this project's framework/structure, skip it
      continue
    }

    // resolve the variant to use — priority order:
    // 1. AST-found anchor from detect-code-architecture (most precise)
    // 2. framework-specific variant from the module's PlanConfig
    // 3. fallback variant from the module's PlanConfig
    // 4. null → can't inject safely, add as conflict for user to resolve
    const resolvedVariant = resolveVariant(
      ctx,
      injection.type,
      framework,
      injection.variants,
      injection.fallback,
    )

    if (!resolvedVariant) {
      // no anchor found anywhere — we cannot inject safely
      // record this as something the user needs to handle manually
      unresolvableInjections.push(`${injection.type} into ${targetFile} — no injection point found`)
      continue
    }

    injectionActions.push({
      file: targetFile,
      type: injection.type,
      payload: resolvedVariant.payload,
      anchor: resolvedVariant.anchor,
      position: resolvedVariant.position,
      description: `${injection.type} → ${targetFile}`,
    })

    // track the file as needing modification
    if (!filesToModify.find(f => f.path === targetFile)) {
      filesToModify.push({
        path: targetFile,
        operation: 'inject',
        description: `inject ${injection.type}`,
      })
    }
  }

  // ── 3. classify conflicts ──────────────────────────────────
  const filePathsToCreate = filesToCreate.map(f => f.path)
  const { level, actions: conflictActions } = await classifyConflicts(
    ctx.projectRoot,
    ctx,
    filePathsToCreate,
    config.schemaTables,
  )

  // full conflict = bail unless force flag is set
  // the command layer handles the force decision — thinker just records it
  if (level === 'full') {
    conflictActions.push({
      file: 'project',
      level: 'full',
      description: `Existing ${config.moduleName} implementation detected. Full conflict — manual review required.`,
      resolution: 'pending-user-choice',
    })
  }

  // unresolvable injections become conflict actions too
  for (const msg of unresolvableInjections) {
    conflictActions.push({
      file: 'injection',
      level: 'partial',
      description: msg,
      resolution: 'pending-user-choice',
    })
  }

  // ── 4. resolve env vars ────────────────────────────────────
  const envVarsToAdd = config.envVars.map(e => ({
    key: e.key,
    description: e.description,
    example: e.example,
  }))

  // ── 5. build rollback hints ────────────────────────────────
  // simple: delete the files we created, revert the files we modified
  const rollbackHints = [
    ...filesToCreate.map(f => `delete ${f.path}`),
    ...filesToModify.map(f => `revert ${f.path}`),
  ]

  // ── 6. assemble InstallPlan ────────────────────────────────
  return {
    moduleName: config.moduleName,
    selectedFeatures,
    dependenciesToInstall: config.dependencies,
    devDependenciesToInstall: config.devDependencies,
    envVarsToAdd,
    filesToCreate,
    filesToModify,
    migrationsToCreate:
      config.schemaTables.length > 0 ? [`${Date.now()}_add_${config.moduleName}_tables`] : [],
    injectionActions,
    conflictActions,
    rollbackHints,
  }
}

// ============================================================
// resolveVariant — anchor resolution priority chain
// ============================================================

interface ResolvedVariant {
  payload: string
  anchor: string
  position: 'before' | 'after'
}

function resolveVariant(
  ctx: DetectedContext,
  injectionType: InjectionType,
  framework: DetectedContext['framework']['value'],
  variants: PlanConfig['injections'][number]['variants'],
  fallback: PlanConfig['injections'][number]['fallback'],
): ResolvedVariant | null {
  // priority 1 — AST-found anchor from detect-code-architecture
  // most precise because it was found by actually reading the code
  const astAnchor = ctx.codeArchitecture.injectionAnchors[injectionType]
  if (astAnchor && astAnchor.anchorText) {
    // we have an AST anchor — but we still need the payload from the variant
    // the AST anchor tells us WHERE, the variant tells us WHAT
    const variant = variants[framework] ?? fallback
    if (variant) {
      return {
        payload: variant.payload,
        anchor: astAnchor.anchorText, // use AST anchor, not variant anchor
        position: astAnchor.position,
      }
    }
  }

  // priority 2 — framework-specific variant from the module
  const frameworkVariant = variants[framework]
  if (frameworkVariant) return frameworkVariant

  // priority 3 — fallback variant
  if (fallback) return fallback

  // priority 4 — nothing found, caller handles this
  return null
}
