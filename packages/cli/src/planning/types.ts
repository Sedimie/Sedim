// CLI re-exports all shared types from @sedim/core
// module authors import directly from @sedim/core
// CLI internals import from here so import paths stay consistent
export type {
  AppEntrypoint,
  CodeArchitecture,
  ConflictAction,
  ConflictLevel,
  ConflictSignals,
  DBType,
  Detected,
  DetectedContext,
  EnvVarConfig,
  FileOperation,
  FileToCreate,
  FileToModify,
  Framework,
  InjectionAction,
  InjectionAnchor,
  InjectionConfig,
  InjectionType,
  InjectionVariant,
  InstalledModuleState,
  InstallPlan,
  Language,
  LayoutStyle,
  ModuleManifest,
  ModuleManifestLayers,
  ModuleSystem,
  ORM,
  PackageManager,
  PeerContract,
  PlanConfig,
  ProjectStructure,
  RouterStyle,
  SchemaSignals,
  TemplateConfig,
  UILevel,
} from '@sedim/core'

// ── CLI-only types ────────────────────────────────────────────
// these are internal to the CLI engine and not needed by modules

export type SessionStatus = 'active' | 'paused' | 'failed' | 'complete'

export interface SessionState {
  moduleName: string
  startedAt: string
  lastUpdatedAt: string
  currentStep: string
  completedSteps: string[]
  selectedOptions: Record<string, unknown>
  planSnapshot: import('@sedim/core').InstallPlan
  status: SessionStatus
  failureReason?: string
}

export interface SourceStructure {
  srcDir: string | null
  apiDir: string | null
  routeEntrypoints: string[]
}

export interface SedimConfig {
  framework: import('@sedim/core').Framework
  orm: import('@sedim/core').ORM
  db: import('@sedim/core').DBType
  language: import('@sedim/core').Language
  moduleSystem: import('@sedim/core').ModuleSystem
  sourceStructure: SourceStructure
  preferences: {
    ui: import('@sedim/core').UILevel
    confirmBeforeWrite: boolean
    dryRunByDefault: boolean
  }
  overrides: Record<string, unknown>
  generatedAt: string
}
