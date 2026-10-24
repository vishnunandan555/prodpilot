/**
 * ProdPilot Scope & Identifier Validator
 * Performs AST static analysis across all frontend code to prevent
 * undeclared variable references (e.g. removed helpers, typos, broken imports)
 * from crashing the React tree or causing blank screens.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '../src');

// Standard ECMAScript + HTML5 / DOM browser globals allowed in frontend code
const KNOWN_GLOBALS = new Set([
  'window', 'document', 'console', 'localStorage', 'sessionStorage',
  'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'navigator', 'EventSource', 'URLSearchParams', 'URL', 'JSON', 'Math', 'Date',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Error',
  'Promise', 'encodeURIComponent', 'decodeURIComponent', 'process',
  'alert', 'confirm', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'Set', 'Map', 'WeakSet', 'WeakMap', 'location', 'requestAnimationFrame',
  'cancelAnimationFrame', 'FileReader', 'FormData', 'Headers', 'Blob',
  'File', 'Uint8Array', 'ArrayBuffer', 'TextEncoder', 'TextDecoder',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'WebSocket',
  'crypto', 'btoa', 'atob', 'history', 'customElements', 'Event'
]);

let totalErrors = 0;
let filesScanned = 0;

function validateFile(filePath) {
  const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
  const code = fs.readFileSync(filePath, 'utf8');

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
      errorRecovery: false,
    });
  } catch (err) {
    console.error(`❌ [Parse Error] ${relPath}:${err.loc?.line || '?'}:${err.loc?.column || '?'}: ${err.message}`);
    totalErrors++;
    return;
  }

  filesScanned++;
  const unbound = [];

  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (KNOWN_GLOBALS.has(name)) return;
      if (!p.scope.hasBinding(name)) {
        unbound.push({
          name,
          line: p.node.loc?.start?.line,
          col: p.node.loc?.start?.column,
        });
      }
    },
  });

  if (unbound.length > 0) {
    unbound.forEach((u) => {
      console.error(`❌ [Undeclared Identifier] ${relPath}:${u.line}:${u.col} -> '${u.name}' is referenced but not declared or imported!`);
      totalErrors++;
    });
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(jsx|js)$/.test(entry.name)) {
      validateFile(fullPath);
    }
  }
}

console.log('🔍 Validating frontend variable scopes and references across src/...');
scanDir(ROOT);

if (totalErrors > 0) {
  console.error(`\n🚨 Validation FAILED: Found ${totalErrors} unbound identifier(s) across ${filesScanned} files.`);
  console.error('Fix these references before building to prevent runtime React blank-screen crashes!\n');
  process.exit(1);
} else {
  console.log(`\n✅ Scope validation PASSED: Clean AST across all ${filesScanned} files. Zero undeclared references.\n`);
  process.exit(0);
}
