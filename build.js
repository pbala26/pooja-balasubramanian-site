#!/usr/bin/env node
// Static build step — this is a flat static site with no framework, so
// "building" means three things: stitching the shared header/footer/
// font-links partials (in partials/) back into every page via a tiny
// <!-- @include name.html --> marker; picking a random, own-category-
// biased set of "related articles" for each Writing/Film/Exhibition
// page via a <!-- @related --> marker (data/articles.json is the one
// source of truth for that catalog — see also index.html, which is
// hand-authored from the same list, not generated); then copying the
// resolved HTML plus every other static asset (css, js, images, pdfs)
// into dist/, which is what actually gets deployed. Zero dependencies.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const PARTIALS_DIR = path.join(ROOT, 'partials');
const INCLUDE_RE = /<!--\s*@include\s+([\w.-]+)\s*-->/g;
const RELATED_RE = /<!--\s*@related\s*-->/;
const CATEGORY_RE = /<body[^>]*\bdata-category="([\w-]+)"/;

// Top-level entries that are source/tooling, not site output. `data/`
// used to be build-time-only (this script reads data/articles.json to
// generate each article page's "related" section) but the homepage
// hero CTA (hero-cta.js) now fetches it client-side too, at runtime —
// so it has to actually ship in dist/, not just get read during build.
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

// Related articles: no curation, no "similarity" logic — just a random
// draw from the Writing/Film/Exhibition catalog, weighted 2x toward the
// current page's own category so it still reads as "more like this"
// on average, while always mixing in the other categories too. Picked
// fresh on every build (not per-visitor — this is a static site).
const ARTICLES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'articles.json'), 'utf8'));

function pickRelated(currentHref, currentCategory) {
  const count = Math.random() < 0.5 ? 5 : 6;
  const pool = ARTICLES.filter((a) => a.href !== currentHref);
  const weighted = [];
  for (const a of pool) {
    weighted.push(a);
    if (a.category === currentCategory) weighted.push(a); // own category counted twice
  }
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  const seen = new Set();
  const picked = [];
  for (const a of weighted) {
    if (seen.has(a.href)) continue;
    seen.add(a.href);
    picked.push(a);
    if (picked.length >= count) break;
  }
  return picked;
}

function renderRelatedItem(a) {
  const thumb = a.thumb
    ? `<div class="related-thumb has-image" style="background-image:url('${a.thumb}')" role="img" aria-label="Preview image"></div>`
    : `<div class="related-thumb" role="img" aria-label="Preview image">Preview image placeholder</div>`;
  return `<a class="related-item" href="${a.href}">
          ${thumb}
          <span class="related-cat">${a.catLabel}</span>
          <h4 class="related-title">${a.title} &#8594;</h4>
          <p class="related-sub">${a.sub}</p>
        </a>`;
}

function resolveRelated(html, currentHref) {
  if (!RELATED_RE.test(html)) return html;
  const categoryMatch = html.match(CATEGORY_RE);
  const items = pickRelated(currentHref, categoryMatch ? categoryMatch[1] : null);
  return html.replace(RELATED_RE, items.map(renderRelatedItem).join('\n        '));
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

// Write/copy with one retry: if the destination already exists and is
// somehow locked/permission-restricted (seen on networked/sandboxed
// mounts — a stale copy left in a weird state), unlink it first and
// try again. If it still fails, warn and skip that one file rather
// than aborting the entire build.
function safeWrite(destPath, doWrite) {
  try {
    doWrite();
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(destPath)) fs.rmSync(destPath, { force: true });
      doWrite();
      return true;
    } catch (err2) {
      console.warn(`Warning: skipped ${path.relative(ROOT, destPath)} (${err2.code || err.code}) — delete it manually (or the whole dist/ folder) and rebuild if this keeps happening`);
      return false;
    }
  }
}

let fileCount = 0;
let skipped = 0;
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
      const relHref = path.relative(ROOT, srcPath).split(path.sep).join('/');
      const ok = safeWrite(destPath, () => {
        let html = resolveIncludes(fs.readFileSync(srcPath, 'utf8'));
        html = resolveRelated(html, relHref);
        fs.writeFileSync(destPath, html);
      });
      ok ? fileCount++ : skipped++;
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const ok = safeWrite(destPath, () => fs.copyFileSync(srcPath, destPath));
      ok ? fileCount++ : skipped++;
    }
  }
}

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });
copyTree(ROOT, DIST);

console.log(`Built ${fileCount} files into ${path.relative(ROOT, DIST)}/${skipped ? ` (${skipped} skipped — see warnings above)` : ''}`);
