#!/usr/bin/env node
// Static build step — this is a flat static site with no framework, so
// the only thing "building" means here is stitching the shared header/
// footer/font-links partials (in partials/) back into every page via a
// tiny <!-- @include name.html --> marker, then copying the resolved
// HTML plus every other static asset (css, js, images, pdfs) into
// dist/, which is what actually gets deployed. Zero dependencies.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const PARTIALS_DIR = path.join(ROOT, 'partials');
const INCLUDE_RE = /<!--\s*@include\s+([\w.-]+)\s*-->/g;

// Top-level entries that are source/tooling, not site output.
const SKIP = new Set([
  'dist', 'partials', 'node_modules', '.git', '.github', '.wrangler',
  'server.js', 'build.js', 'package.json', 'package-lock.json', '.gitignore',
]);

const partialCache = new Map();
function readPartial(name) {
  if (partialCache.has(name)) return partialCache.get(name);
  const file = path.join(PARTIALS_DIR, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing partial "${name}" — referenced via @include but not found at partials/${name}`);
  }
  const content = fs.readFileSync(file, 'utf8');
  partialCache.set(name, content);
  return content;
}

function resolveIncludes(html) {
  return html.replace(INCLUDE_RE, (_, name) => readPartial(name));
}

function rmrf(dir) {
  // Best-effort: some sandboxed/networked filesystems refuse to unlink
  // certain leftover files (e.g. a stray .wrangler cache) with EPERM
  // even though force:true is set (force only swallows ENOENT). A
  // half-clean dist/ that then gets overwritten is fine — don't let
  // that crash the whole build.
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`Warning: couldn't fully clean ${path.relative(ROOT, dir)}/ (${err.code}) — continuing, files will be overwritten`);
  }
}

let fileCount = 0;
function copyTree(srcDir, destDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (srcDir === ROOT && SKIP.has(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTree(srcPath, destPath);
    } else if (entry.name.endsWith('.html')) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, resolveIncludes(fs.readFileSync(srcPath, 'utf8')));
      fileCount++;
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
    }
  }
}

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });
copyTree(ROOT, DIST);

console.log(`Built ${fileCount} files into ${path.relative(ROOT, DIST)}/`);
