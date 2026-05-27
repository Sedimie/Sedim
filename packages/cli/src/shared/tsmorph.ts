// Lazy ts-morph loader
// modules that use ts-morph call: const tsmod = await import('../shared/tsmorph.js')
// and then destructure: const { Project, SyntaxKind } = tsmod

export async function loadTsMorph() {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const { Project, SyntaxKind, QuoteKind, VariableDeclarationKind, Node } = await import('ts-morph')
  return { Project, SyntaxKind, QuoteKind, VariableDeclarationKind, Node }
}
