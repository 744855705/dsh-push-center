#!/usr/bin/env node
/**
 * Wrap the built CommonJS client body in the DSH loader registration:
 * window.__ModuleLoader__.load({ id, factory: (require) => exports }).
 * Externals (react, react/jsx-runtime) stay require() calls answered by the
 * loader's module table.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

const dir = new URL('../client/', import.meta.url)
const bundle = new URL('client.js', dir)
if (!existsSync(bundle)) {
  const alternative = new URL('client.cjs', dir)
  if (!existsSync(alternative)) {
    console.error('wrap-client: no client bundle found')
    process.exit(1)
  }
  renameSync(alternative, bundle)
}
const id = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name
const body = readFileSync(bundle, 'utf8')
const wrapped = [
  'window.__ModuleLoader__.load({ id: ' + JSON.stringify(id) + ', factory: (require) => {',
  'var module = { exports: {} };',
  'var exports = module.exports;',
  body,
  'return module.exports;',
  '} });',
  '',
].join('\n')
writeFileSync(bundle, wrapped)
console.log('wrap-client: client/client.js ready (' + wrapped.length + ' bytes)')
