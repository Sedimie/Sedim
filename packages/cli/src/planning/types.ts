// ============================================================
// Primitives
// ============================================================

export type Language = 'typescript' | 'javascript'
export type ModuleSystem = 'esm' | 'cjs' | 'unknown'
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'
export type Framework = 'nextjs' | 'express' | 'hono' | 'fastify' | 'unknown'
export type ORM = 'drizzle' | 'prisma' | 'none' | 'unknown'
export type DBType = 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'unknown'
export type RouterStyle = 'centralized' | 'file-based' | 'plugin-based' | 'unknown'
export type LayoutStyle = 'app-router' | 'pages-router' | 'unknown'
export type ConflictLevel = 'none' | 'partial' | 'full'
export type SessionStatus = 'active' | 'paused' | 'failed' | 'complete'
export type UILevel = 'none' | 'headless' | 'tailwind' | 'themed'
export type InjectionType = 'import' | 'route' | 'provider-wrap' | 'middleware' | 'env-var'
export type FileOperation = 'create' | 'modify' | 'skip'

// ============================================================
// Detected<T> — every detector result carries confidence + evidence
// so the thinker knows whether to ask the user or trust the detection
// ============================================================

export type Detected<T> = {
  value: T
  confidence: 'high' | 'medium' | 'low'
  evidence: string[] // e.g. ["found next.config.ts", "next in dependencies"]
}

// ============================================================
// Sub-interfaces for DetectedContext
// ============================================================

export interface ProjectStructure {
  srcDir: string | null              // e.g. "src" or "app" or null if flat
  routeEntrypoints: string[]         // files that define routes
  middlewareCandidates: string[]     // files likely to register middleware
}

export interface SchemaSignals {
  tables: string[]                   // table names found in schema files
  probableUserTable: string | null   // best guess at the users table
  authSignals: string[]              // e.g. ["found password_hash column", "lucia detected in deps"]
  existingAuthDetected: boolean
}

export interface AppEntrypoint {
  file: string                       // e.g. "src/app.ts"
  exportsAppInstance: boolean        // does it export the framework app object?
  exportName: string | null          // e.g. "app", "default"
}

// a precise location found by ts-morph AST analysis
// this is what the writer uses to inject code without guessing
export interface InjectionAnchor {
  file: string                       // relative path to the file
  anchorText: string                 // the exact text to anchor against in the file
  position: 'before' | 'after'      // where to insert relative to anchor
  description: string                // human-readable: "after last app.use() call"
}

export interface CodeArchitecture {
  routerStyle: RouterStyle
  layoutStyle: LayoutStyle           // Next.js specific, 'unknown' for others
  appEntrypoint: AppEntrypoint | null
  apiDir: string | null              // e.g. "app/api" or "pages/api"
  providersFile: string | null       // existing providers wrapper if any
  hasBarrelExports: boolean          // src/index.ts that re-exports things
  importStyle: 'named' | 'default' | 'mixed'
  // precise injection points found by AST analysis
  // keyed by InjectionType — only populated for types the detector could find
  injectionAnchors: Partial<Record<InjectionType, InjectionAnchor>>
}

export interface ConflictSignals {
  level: ConflictLevel
  existingAuthDetected: boolean
  signals: string[]                  // human-readable reasons for the conflict level
}

// ============================================================
// DetectedContext — full output of the detector
// ============================================================

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
}

// ============================================================
// InstallPlan — full output of the thinker, input to the writer
// ============================================================

export interface FileToCreate {
  path: string                       // relative to projectRoot
  templateKey: string                // which template to render
  content?: string                   // pre-rendered content if available
}

export interface FileToModify {
  path: string
  operation: 'patch' | 'inject'
  description: string                // human-readable: "add auth middleware import"
  backupPath?: string                // where to write a backup before modifying
}

export interface InjectionAction {
  file: string
  type: InjectionType
  payload: string                    // the actual code string to inject
  anchor: string                     // the string to insert before/after
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
  migrationsToCreate: string[]       // migration file names to generate
  injectionActions: InjectionAction[]
  conflictActions: ConflictAction[]
  rollbackHints: string[]            // what to undo if something goes wrong
}

// ============================================================
// SessionState — persisted to .sedim/session.json
// enables sedim continue after interruption
// ============================================================

export interface SessionState {
  moduleName: string
  startedAt: string                  // ISO timestamp
  lastUpdatedAt: string
  currentStep: string                // e.g. "writer:inject-routes"
  completedSteps: string[]
  selectedOptions: Record<string, unknown>  // user's answers to prompts
  planSnapshot: InstallPlan          // the plan as it was when session started
  status: SessionStatus
  failureReason?: string
}

// ============================================================
// InstalledModuleState — persisted to .sedim/modules/<name>.json
// this is what makes upgrades possible — the diff target
// ============================================================

export interface InstalledModuleState {
  module: string
  version: string
  installedAt: string
  lastUpgradedAt?: string
  selectedFeatures: string[]
  ui: UILevel
  framework: Framework
  orm: ORM
  stampedFiles: string[]             // files the writer created/modified — never touch without approval
  pendingUpgrades: string[]          // features available in registry but not installed
}

// ============================================================
// SedimConfig — shape of sedim.config.ts in the user's project
// ============================================================

export interface SourceStructure {
  srcDir: string | null
  apiDir: string | null
  routeEntrypoints: string[]
}

export interface SedimConfig {
  framework: Framework
  orm: ORM
  db: DBType
  language: Language
  moduleSystem: ModuleSystem
  sourceStructure: SourceStructure
  preferences: {
    ui: UILevel
    confirmBeforeWrite: boolean
    dryRunByDefault: boolean
  }
  overrides: Record<string, unknown>  // escape hatch for edge cases
  generatedAt: string                 // ISO timestamp + CLI version stamp
}

// ============================================================
// ModuleManifest — pulled from registry, describes what a module can do
// the CLI resolves the user's combination at install time from this
// ============================================================

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
    peerModules: string[]            // e.g. chat requires auth
  }
  adapters: {
    frameworks: Framework[]
    orms: ORM[]
  }
}

// ============================================================
// PlanConfig — what a module provides to the thinker
// the thinker resolves this against DetectedContext to produce InstallPlan
// ============================================================

export interface TemplateConfig {
  templateKey: string
  // function because output path depends on detected framework/structure
  // e.g. Next.js app router → src/app/api/auth/route.ts
  //      Next.js pages router → src/pages/api/auth.ts
  outputPath: (ctx: DetectedContext) => string
  overwriteStrategy: 'skip' | 'overwrite' | 'ask'
}

export interface InjectionVariant {
  payload: string              // the code string to inject
  anchor: string               // what to find in the file to anchor against
  position: 'before' | 'after'
}

export interface InjectionConfig {
  type: InjectionType
  // which file to inject into — depends on framework
  target: (ctx: DetectedContext) => string | null
  // framework-specific payloads — thinker picks the matching variant
  variants: Partial<Record<Framework, InjectionVariant>>
  // used when no framework variant matches
  fallback?: InjectionVariant
}

export interface EnvVarConfig {
  key: string
  description: string
  example?: string
  required: boolean
}

export interface PeerContract {
  module: string               // e.g. 'auth'
  provides: string[]           // what it provides: ['getCurrentUser', 'getSession']
  required: boolean            // hard dependency or optional enhancement
}

export interface PlanConfig {
  moduleName: string
  version: string
  // files the module wants to stamp — thinker resolves outputPath per project
  templates: TemplateConfig[]
  // code injections needed — thinker picks the right variant per framework
  injections: InjectionConfig[]
  dependencies: string[]
  devDependencies: string[]
  envVars: EnvVarConfig[]
  // tables this module creates — used for conflict detection against existing schema
  schemaTables: string[]
  // what this module needs from other modules — keeps modules decoupled
  peerContracts: PeerContract[]
}
