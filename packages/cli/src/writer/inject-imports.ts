import path from 'node:path'
import { Project } from 'ts-morph'
import { WriteError } from '../shared/errors'
import { exists, readText, writeText } from '../shared/fs'

// adds an import statement to a file without duplicating it
// uses ts-morph to find the last existing import and insert after it
// if the import already exists (same specifier), skips silently
export async function injectImport(
  projectRoot: string,
  filePath: string,
  importStatement: string,
): Promise<'injected' | 'skipped'> {
  const absPath = path.join(projectRoot, filePath)

  if (!(await exists(absPath))) {
    throw new WriteError(
      `Cannot inject import into "${filePath}" — file does not exist`,
      undefined,
      'Check that the file path in the plan is correct.',
    )
  }

  try {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    })
    const sf = project.addSourceFileAtPath(absPath)

    // extract the module specifier from the import statement
    // e.g. `import { auth } from './lib/auth'` → './lib/auth'
    const specifierMatch = importStatement.match(/from\s+['"]([^'"]+)['"]/)
    const specifier = specifierMatch?.[1]

    // check if this import already exists — skip if so
    if (specifier) {
      const alreadyImported = sf
        .getImportDeclarations()
        .some(imp => imp.getModuleSpecifierValue() === specifier)
      if (alreadyImported) return 'skipped'
    }

    // find the last import declaration and insert after it
    const imports = sf.getImportDeclarations()
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1]
      lastImport.replaceWithText(lastImport.getText() + '\n' + importStatement)
    } else {
      // no existing imports — prepend to file
      sf.insertText(0, importStatement + '\n')
    }

    await writeText(absPath, sf.getFullText())
    return 'injected'
  } catch (err) {
    if (err instanceof WriteError) throw err
    throw new WriteError(`Failed to inject import into ${filePath}`, err)
  }
}
