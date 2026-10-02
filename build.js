#!/usr/bin/env node
/**
 * build.js — JobTrack deterministic build
 * ---------------------------------------------------------------
 * Run manually before every deploy:
 *     node build.js
 *     git add .
 *     git commit -m "deploy: $(date)"
 *     git push
 *
 * What it does:
 *   1. Cleans old hashed script.<hash>.js / style.<hash>.css
 *   2. Hashes script.js and style.css (sha256, first 10 hex chars)
 *   3. Copies source files to hashed names
 *   4. Rewrites index.html refs (idempotent; handles ?v= and already-hashed)
 *   5. Generates YYYYMMDDHHMMSS UTC timestamp (the new version)
 *   6. Rewrites <meta name="app-version"> in index.html
 *   7. Writes app-version.json as { "version": "..." }
 *   8. Rewrites const VERSION = '...'; in sw.js
 *
 * Zero dependencies. CommonJS. Node 14+.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;

// ---------- helpers ----------
function log(step) { console.log(step); }

function readFile(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function writeFile(rel, content) {
    fs.writeFileSync(path.join(ROOT, rel), content);
}
function hash10(rel) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}
function utcStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return (
        d.getUTCFullYear() +
        p(d.getUTCMonth() + 1) +
        p(d.getUTCDate()) +
        p(d.getUTCHours()) +
        p(d.getUTCMinutes()) +
        p(d.getUTCSeconds())
    );
}

// ---------- 1. clean old hashed files ----------
log('\n🧹 Cleaning old hashed files...');
const hashedPattern = /^(script|style)\.[a-f0-9]{10}\.(js|css)$/;
let cleaned = 0;
fs.readdirSync(ROOT).forEach((f) => {
    if (hashedPattern.test(f)) {
        fs.unlinkSync(path.join(ROOT, f));
        log(`   🗑️  removed ${f}`);
        cleaned++;
    }
});
if (cleaned === 0) log('   (none found)');

// ---------- 2. hash source files ----------
log('\n🔐 Hashing source files...');
const scriptHash = hash10('script.js');
const styleHash  = hash10('style.css');
const hashedScript = `script.${scriptHash}.js`;
const hashedStyle  = `style.${styleHash}.css`;
log(`   ✅ script.js → ${hashedScript}`);
log(`   ✅ style.css → ${hashedStyle}`);

// ---------- 3. copy to hashed names ----------
log('\n📄 Writing hashed copies...');
fs.copyFileSync(path.join(ROOT, 'script.js'), path.join(ROOT, hashedScript));
fs.copyFileSync(path.join(ROOT, 'style.css'),  path.join(ROOT, hashedStyle));
log(`   ✅ ${hashedScript}`);
log(`   ✅ ${hashedStyle}`);

// ---------- 4. rewrite index.html refs ----------
log('\n📝 Rewriting index.html asset references...');
let html = readFile('index.html');

// style.css — matches:  style.css  |  style.css?v=123  |  style.<10hex>.css  |  style.<10hex>.css?v=123
const styleRe = /(href\s*=\s*["'])style(?:\.[a-f0-9]{10})?\.css(?:\?[^"']*)?(["'])/g;
const styleBefore = html;
html = html.replace(styleRe, `$1${hashedStyle}$2`);
if (html === styleBefore) {
    log('   ⚠️  no <link rel="stylesheet" href="style...css"> match found');
} else {
    log(`   ✅ style.css → ${hashedStyle}`);
}

// script.js — matches:  script.js  |  script.js?v=123  |  script.<10hex>.js  |  script.<10hex>.js?v=123
const scriptRe = /(src\s*=\s*["'])script(?:\.[a-f0-9]{10})?\.js(?:\?[^"']*)?(["'])/g;
const scriptBefore = html;
html = html.replace(scriptRe, `$1${hashedScript}$2`);
if (html === scriptBefore) {
    log('   ⚠️  no <script src="script...js"> match found');
} else {
    log(`   ✅ script.js → ${hashedScript}`);
}

// ---------- 5. new version ----------
const version = utcStamp();
log(`\n🕒 New version: ${version}`);

// ---------- 6. rewrite <meta name="app-version"> ----------
log('\n📝 Updating <meta name="app-version">...');
const metaRe = /(<meta\s+name=["']app-version["']\s+content=["'])[^"']*(["']\s*\/?>)/i;
if (metaRe.test(html)) {
    html = html.replace(metaRe, `$1${version}$2`);
    log(`   ✅ content="${version}"`);
} else {
    log('   ⚠️  <meta name="app-version"> not found — skipping');
}

writeFile('index.html', html);
log('   ✅ index.html written');

// ---------- 7. write app-version.json ----------
log('\n📝 Writing app-version.json...');
writeFile('app-version.json', JSON.stringify({ version }, null, 2) + '\n');
log(`   ✅ { "version": "${version}" }`);

// ---------- 8. rewrite sw.js VERSION ----------
log('\n📝 Updating sw.js VERSION constant...');
let sw = readFile('sw.js');
const swRe = /(const\s+VERSION\s*=\s*['"])[^'"]*(['"]\s*;)/;
if (swRe.test(sw)) {
    sw = sw.replace(swRe, `$1${version}$2`);
    writeFile('sw.js', sw);
    log(`   ✅ const VERSION = '${version}';`);
} else {
    log('   ⚠️  const VERSION = \'...\'; not found in sw.js — skipping');
}

log('\n✅ Build complete. Now run:');
log('   git add .');
log('   git commit -m "deploy: $(date)"');
log('   git push\n');