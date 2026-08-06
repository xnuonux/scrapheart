// Build SCRAPHEART as ONE file dom can double-click.
//
// ⚠ The point of this is not tidiness. The P0 gate needs ten people playing it for an
// hour, and every step between "here it is" and "it is running" loses some of them.
// No npm, no server, no terminal, no install. A file, a browser, a game.
//
// Chrome blocks ES-module imports over file://, so the bundle is re-emitted as an IIFE
// and inlined as a classic script. A module <script> here would look correct, ship, and
// fail silently on the one thing this file exists to do.
import { build } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const TMP = path.join(ROOT, '.singlefile')

await build({
  root: ROOT,
  logLevel: 'warn',
  build: {
    outDir: TMP,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,   // inline every asset, whatever it is
    cssCodeSplit: false,
    rollupOptions: {
      input: path.join(ROOT, 'src/main.ts'),
      output: { format: 'iife', entryFileNames: 'bundle.js', inlineDynamicImports: true },
    },
  },
})

const js = fs.readFileSync(path.join(TMP, 'bundle.js'), 'utf8')
const cssPath = fs.readdirSync(TMP).find(f => f.endsWith('.css'))
const css = cssPath ? fs.readFileSync(path.join(TMP, cssPath), 'utf8') : ''

// take the real index.html and swap the module tag for the inlined bundle
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
html = html.replace(/<script\b[^>]*type="module"[^>]*><\/script>\s*/g, '')
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>\s*/g, '')
if (css) html = html.replace('</head>', `<style>${css}</style>\n</head>`)
html = html.replace('</body>', `<script>\n${js}\n</script>\n</body>`)

const outFile = path.join(ROOT, 'SCRAPHEART.html')
fs.writeFileSync(outFile, html)
fs.rmSync(TMP, { recursive: true, force: true })

const kb = (fs.statSync(outFile).size / 1024).toFixed(0)
console.log(`SCRAPHEART.html  ${kb} kB  ... one file, no server, double-click it`)
if (/<script[^>]*type="module"/.test(html)) {
  console.error('🚨 a module script survived. it will not run from file://')
  process.exit(1)
}
if (/\bimport\s|\bexport\s/.test(js.slice(0, 400))) {
  console.error('🚨 the bundle still has module syntax at the top. format did not apply.')
  process.exit(1)
}
