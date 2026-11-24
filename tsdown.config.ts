/**
 * Client bundle: the DSH loader closure-factory artifact.
 *
 * Emits CommonJS so externals resolve through the loader's injected
 * `require`; scripts/wrap-client.mjs then wraps the body in
 * `window.__ModuleLoader__.load({ id, factory })`.
 */
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'client',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react/jsx-runtime'],
  alias: { qrcode: 'qrcode/lib/browser.js' },
  noExternal: (id: string) => id !== 'react' && id !== 'react/jsx-runtime',
})
