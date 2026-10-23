// Generates the @solana/kit client for the pickpay program into app/src/generated/pickpay
// from the Anchor IDL. Run after `anchor build --arch v1`.
import { readFileSync } from 'node:fs'
import { createFromRoot } from 'codama'
import { rootNodeFromAnchor, type AnchorIdl } from '@codama/nodes-from-anchor'
import { renderVisitor } from '@codama/renderers-js'

const ROOT = new URL('..', import.meta.url).pathname
const idl = JSON.parse(readFileSync(`${ROOT}target/idl/pickpay.json`, 'utf8')) as AnchorIdl

createFromRoot(rootNodeFromAnchor(idl)).accept(
  renderVisitor(`${ROOT}app`, {
    generatedFolder: 'src/generated/pickpay',
    dependencyVersions: { '@solana/kit': '8.5.0' },
    // app/package.json pins kit as a regular dependency; don't let the renderer rewrite it.
    syncPackageJson: false,
  }),
)
console.log('generated app/src/generated/pickpay')
