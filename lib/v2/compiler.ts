import path from 'path'
import { transform } from 'sucrase'
import { RUNTIME_SDK_SOURCE } from '@/lib/v2/runtime-sdk'
import { isAllowedImport } from '@/lib/v2/runtime-catalog'
import { SourceFile } from '@/lib/v2/types'

const IMPORT_PATTERN = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]+?\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/g

export interface CompiledArtifact {
  name: 'index.html' | 'app.js' | 'app.css' | 'sdk.js'
  body: string | Uint8Array
}

function normalizeSourcePath(filePath: string): string {
  const normalized = path.posix.normalize(filePath.replaceAll('\\', '/')).replace(/^\/+/, '')
  if (!normalized.startsWith('src/') || normalized.includes('..')) {
    throw new Error(`Unsupported source path: ${filePath}`)
  }
  if (!/\.(?:ts|tsx|js|jsx|css|json)$/.test(normalized)) {
    throw new Error(`Unsupported file type: ${filePath}`)
  }
  return normalized
}

export function validateSourceFiles(files: SourceFile[]): SourceFile[] {
  if (files.length === 0 || files.length > 24) throw new Error('A project must contain 1-24 source files.')
  const seen = new Set<string>()
  let totalSize = 0
  const normalized = files.map(file => {
    const filePath = normalizeSourcePath(file.path)
    if (seen.has(filePath)) throw new Error(`Duplicate file: ${filePath}`)
    seen.add(filePath)
    totalSize += new TextEncoder().encode(file.content).byteLength
    if (/\bimport\s*\(/.test(file.content) || /\bimport\.meta\b/.test(file.content)) {
      throw new Error(`Dynamic module loading is not supported in ${filePath}.`)
    }
    if (/\b(?:localStorage|sessionStorage)\b|document\.cookie/.test(file.content)) {
      throw new Error(`Browser identity storage is not available in ${filePath}; use component state or window.vibe.data.`)
    }
    if (/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(file.content)) {
      throw new Error(`Direct network access is not available in ${filePath}; use the scoped window.vibe APIs.`)
    }
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(file.content)) {
      throw new Error(`Dynamic code execution is not available in ${filePath}.`)
    }
    for (const match of file.content.matchAll(IMPORT_PATTERN)) {
      if (!isAllowedImport(match[1])) throw new Error(`Package not allowed: ${match[1]}`)
    }
    return { path: filePath, content: file.content }
  })
  if (!seen.has('src/App.tsx')) throw new Error('The project must include src/App.tsx.')
  if (totalSize > 240_000) throw new Error('The generated source is too large.')
  return normalized
}

function htmlShell(title: string, deploymentToken: string, hasCss: boolean): string {
  const safeTitle = title.replace(/[<>&"]/g, '')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="vibe-deployment" content="${deploymentToken}" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${safeTitle}</title>
    ${hasCss ? '<link rel="stylesheet" href="./app.css" />' : ''}
  </head>
  <body>
    <div id="app"></div>
    <script src="/runtime/vendor.js"></script>
    <script src="./sdk.js"></script>
    <script src="./app.js"></script>
  </body>
</html>`
}

function compileModule(file: SourceFile): string {
  const extension = path.posix.extname(file.path)
  if (extension === '.css') return 'module.exports = {};'
  if (extension === '.json') {
    try {
      return `module.exports = ${JSON.stringify(JSON.parse(file.content))};`
    } catch {
      throw new Error(`Invalid JSON in ${file.path}.`)
    }
  }
  try {
    return transform(file.content, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxPragma: 'h',
      jsxFragmentPragma: 'Fragment',
      production: true,
      filePath: file.path,
    }).code
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not compile ${file.path}: ${message}`)
  }
}

function javascriptBundle(files: SourceFile[]): string {
  const moduleFactories = files.map(file => {
    const id = `/${file.path}`
    return `${JSON.stringify(id)}: function(require, module, exports, h, Fragment) {\n${compileModule(file)}\n}`
  }).join(',\n')

  return `(function () {
  'use strict';
  var packages = globalThis.__VIBE_PACKAGES__ || {};
  var packageCache = Object.create(null);
  var modules = {${moduleFactories}};
  var cache = Object.create(null);

  function loadPackage(specifier) {
    if (packageCache[specifier]) return packageCache[specifier];
    var value = packages[specifier];
    if (!value) throw new Error('Package not available: ' + specifier);
    if (value.__esModule) return value;
    var wrapped = {};
    Object.keys(value).forEach(function (key) { wrapped[key] = value[key]; });
    Object.defineProperty(wrapped, '__esModule', { value: true });
    if (!Object.prototype.hasOwnProperty.call(wrapped, 'default')) wrapped.default = value;
    packageCache[specifier] = wrapped;
    return wrapped;
  }

  function normalize(from, specifier) {
    if (specifier.charAt(0) !== '.' && specifier.charAt(0) !== '/') return specifier;
    var base = specifier.charAt(0) === '/'
      ? specifier
      : from.slice(0, from.lastIndexOf('/') + 1) + specifier;
    var parts = [];
    base.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') parts.pop(); else parts.push(part);
    });
    var resolved = '/' + parts.join('/');
    var candidates = [
      resolved, resolved + '.tsx', resolved + '.ts', resolved + '.jsx', resolved + '.js',
      resolved + '.json', resolved + '.css', resolved + '/index.tsx', resolved + '/index.ts',
      resolved + '/index.jsx', resolved + '/index.js'
    ];
    for (var index = 0; index < candidates.length; index += 1) {
      if (modules[candidates[index]]) return candidates[index];
    }
    throw new Error('Could not resolve ' + specifier + ' from ' + from);
  }

  function load(specifier, from) {
    var id = normalize(from || '/src/App.tsx', specifier);
    if (id.charAt(0) !== '/') return loadPackage(id);
    if (cache[id]) return cache[id].exports;
    var factory = modules[id];
    if (!factory) throw new Error('Module not found: ' + id);
    var module = { exports: {} };
    cache[id] = module;
    var preact = packages.preact;
    factory(function (next) { return load(next, id); }, module, module.exports, preact.h, preact.Fragment);
    return module.exports;
  }

  try {
    var root = document.getElementById('app');
    if (!root) throw new Error('Missing app root');
    var component = load('/src/App.tsx').default;
    if (!component) throw new Error('src/App.tsx must export a default component');
    packages.preact.render(packages.preact.h(component, null), root);
  } catch (error) {
    console.error(error);
    var target = document.getElementById('app');
    if (target) target.innerHTML = '<main style="font:16px/1.5 system-ui;padding:40px;color:#241f18"><h1 style="font-size:28px">This creation hit a snag.</h1><p>The maker can open Vibe and remix it to repair the problem.</p></main>';
  }
})();`
}

export async function compileProject(input: {
  files: SourceFile[]
  title: string
  deploymentToken: string
}): Promise<CompiledArtifact[]> {
  const files = validateSourceFiles(input.files)
  const css = files.filter(file => file.path.endsWith('.css')).map(file => file.content).join('\n')
  const javascript = javascriptBundle(files)
  return [
    { name: 'index.html', body: htmlShell(input.title, input.deploymentToken, Boolean(css)) },
    { name: 'app.js', body: javascript },
    ...(css ? [{ name: 'app.css' as const, body: css }] : []),
    { name: 'sdk.js', body: RUNTIME_SDK_SOURCE },
  ]
}
