// ============================================================
// @sedim/core — shared types for modules and CLI
// module authors import from here to write plan-config.ts
// ============================================================

// ── Primitives ───────────────────────────────────────────────

export type Language = 'typescript' | 'javascript'
export type ModuleSystem = 'esm' | 'cjs' | 'unknown'
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'
export type Framework = 'nextjs' | 'express' | 'hono' | 'fastify' | 'unknown'
export type ORM = 'drizzle' | 'prisma' | 'none' | 'unknown'
export type DBType = 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'unknown'
export type RouterStyle = 'centralized' | 'file-based' | 'plugin-based' | 'unknown'
export type LayoutStyle = 'app-router' | 'pages-router' | 'unknown'
export type ConflictLevel = 'none' | 'partial' | 'full'
export type UILevel = 'none' | 'headless' | 'tailwind' | 'themed'
export type InjectionType = 'import' | 'route' | 'provider-wrap' | 'middleware' | 'env-var'
export type FileOperation = 'create' | 'modify' | 'skip'

// ── Detected<T> ──────────────────────────────────────────────

// every detector result carries confidence + evidence
// so the thinker knows whether to ask the user or trust the detection
export type Detected<T> = {
  value: T
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
}

// ── DetectedContext sub-interfaces ───────────────────────────

export interface ProjectStructure {
  srcDir: string | null
  routeEntrypoints: string[]
  middlewareCandidates: string[]
}

export interface SchemaSignals {
  tables: string[]
  probableUserTable: string | null
  authSignals: string[]
  existingAuthDetected: boolean
}

export interface AppEntrypoint {
  file: string
  exportsAppInstance: boolean
  exportName: string | null
}

export interface InjectionAnchor {
  file: string
  anchorText: string
  position: 'before' | 'after'
  description: string
}

export interface CodeArchitecture {
  routerStyle: RouterStyle
  layoutStyle: LayoutStyle
  appEntrypoint: AppEntrypoint | null
  apiDir: string | null
  providersFile: string | null
  hasBarrelExports: boolean
  importStyle: 'named' | 'default' | 'mixed'
  injectionAnchors: Partial<Record<InjectionType, InjectionAnchor>>
}

export interface ConflictSignals {
  level: ConflictLevel
  existingAuthDetected: boolean
  signals: string[]
}

// ── DetectedContext ───────────────────────────────────────────

export interface DetectedFrontend {
  name: string
  absPath: string
  relPath: string
  framework: 'react' | 'vue' | 'svelte'
  buildTool: 'vite' | 'webpack'
}

export interface DetectedContext {
  projectRoot: string
  packageManager: PackageManager
  language: Detected<Language>
  moduleSystem: Detected<ModuleSystem>
  framework: Detected<Framework>
  orm: Detected<ORM>
  db: Detected<DBType>
  structure: ProjectStructure
  schema: SchemaSignals
  codeArchitecture: CodeArchitecture
  runtime: { nodeVersion: string | null }
  conflicts: ConflictSignals
  /** Detected React/Vite frontend app in the same workspace — for full-stack setups */
  frontend?: DetectedFrontend
}

// ── InstallPlan ───────────────────────────────────────────────

export interface FileToCreate {
  path: string
  templateKey: string
  content?: string
}

export interface FileToModify {
  path: string
  operation: 'patch' | 'inject'
  description: string
  backupPath?: string
}

export interface InjectionAction {
  file: string
  type: InjectionType
  payload: string
  anchor: string
  position: 'before' | 'after'
  description: string
}

export interface ConflictAction {
  file: string
  level: ConflictLevel
  description: string
  resolution: 'skip' | 'overwrite' | 'merge' | 'pending-user-choice'
}

export interface InstallPlan {
  moduleName: string
  selectedFeatures: string[]
  dependenciesToInstall: string[]
  devDependenciesToInstall: string[]
  envVarsToAdd: { key: string; description: string; example?: string }[]
  filesToCreate: FileToCreate[]
  filesToModify: FileToModify[]
  migrationsToCreate: string[]
  injectionActions: InjectionAction[]
  conflictActions: ConflictAction[]
  rollbackHints: string[]
}

// ── InstalledModuleState ──────────────────────────────────────

export interface InstalledModuleState {
  module: string
  version: string
  installedAt: string
  lastUpgradedAt?: string
  selectedFeatures: string[]
  ui: UILevel
  framework: Framework
  orm: ORM
  stampedFiles: string[]
  pendingUpgrades: string[]
}

// ── ModuleManifest ────────────────────────────────────────────

export interface ModuleManifestLayers {
  protocol: string[]
  logic: string[]
  persistence: { tables: string[]; requires: string[] }
  contract: { types: string }
  adapter: { frameworks: Framework[]; orms: ORM[] }
  delivery: { stamps: string[] }
  ui: { headless: boolean; tailwind: boolean; themes: string[] }
}

export interface ModuleManifest {
  name: string
  version: string
  layers: ModuleManifestLayers
  features: {
    providers?: string[]
    authorization?: string[]
    ui?: UILevel[]
    session?: string[]
  }
  requires: {
    envVars: string[]
    peerModules: string[]
  }
  /** Per-env-var metadata — used by the CLI to show descriptions and filter by selected features */
  envVarMeta?: Record<string, {
    description: string
    example?: string
    required: boolean
    /** Only prompt for this var if one of these features was selected */
    requiredFor?: string[]
  }>
  adapters: {
    frameworks: Framework[]
    orms: ORM[]
  }
}

// ── PlanConfig ────────────────────────────────────────────────
// what a module provides to the thinker
// module authors implement this in their plan-config.ts

export interface TemplateConfig {
  templateKey: string
  outputPath: (ctx: DetectedContext) => string
  overwriteStrategy: 'skip' | 'overwrite' | 'ask'
}

export interface InjectionVariant {
  payload: string
  anchor: string
  position: 'before' | 'after'
}

export interface InjectionConfig {
  type: InjectionType
  target: (ctx: DetectedContext) => string | null
  variants: Partial<Record<Framework, InjectionVariant>>
  fallback?: InjectionVariant
}

export interface EnvVarConfig {
  key: string
  description: string
  example?: string
  /** Pre-filled default value stamped into .env. Use for non-secret values like APP_URL. */
  default?: string
  required: boolean
}

export interface PeerContract {
  module: string
  provides: string[]
  required: boolean
}

export interface PlanConfig {
  moduleName: string
  version: string
  templates: TemplateConfig[]
  injections: InjectionConfig[]
  dependencies: string[]
  devDependencies: string[]
  envVars: EnvVarConfig[]
  schemaTables: string[]
  peerContracts: PeerContract[]
}
