#!/usr/bin/env node
/**
 * Downloads all photo_url and company_logo_url images from default-list.json
 * into static/images/speakers/{photos,logos}/, then rewrites the JSON
 * to use local relative paths — but only if every download succeeded.
 *
 * Usage: node scripts/download-speaker-images.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const JSON_PATH   = path.join(ROOT, 'default-list.json');
const PHOTOS_DIR  = path.join(ROOT, 'static', 'images', 'speakers', 'photos');
const LOGOS_DIR   = path.join(ROOT, 'static', 'images', 'speakers', 'logos');

// ─── helpers ────────────────────────────────────────────────────────────────

function sanitize(str) {
  return (str || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/, '');
}

function extFromUrl(urlStr) {
  try {
    const ext = path.extname(new URL(urlStr).pathname).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext) ? ext : null;
  } catch {
    return null;
  }
}

function extFromContentType(ct = '') {
  if (ct.includes('svg'))  return '.svg';
  if (ct.includes('png'))  return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif'))  return '.gif';
  return '.jpg';
}

function download(urlStr, destBase) {
  return new Promise((resolve, reject) => {
    const attempt = (u, hops) => {
      if (hops > 10) return reject(new Error('too many redirects'));

      let parsed;
      try { parsed = new URL(u); } catch { return reject(new Error(`invalid url: ${u}`)); }

      const mod = parsed.protocol === 'https:' ? https : http;

      const req = mod.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; image-downloader/1.0)',
          'Accept': 'image/*,*/*',
        },
        timeout: 30000,
      }, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const loc = res.headers.location;
          attempt(loc.startsWith('http') ? loc : new URL(loc, u).href, hops + 1);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        const ext  = extFromUrl(u) || extFromContentType(res.headers['content-type']);
        const dest = destBase + ext;
        const ws   = fs.createWriteStream(dest);
        res.pipe(ws);
        ws.on('finish', () => resolve(dest));
        ws.on('error',  reject);
        res.on('error', reject);
      });

      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    };

    attempt(urlStr, 0);
  });
}

function uniqueKey(base, used) {
  if (!used.has(base)) { used.add(base); return base; }
  let i = 2;
  while (used.has(`${base}-${i}`)) i++;
  const k = `${base}-${i}`;
  used.add(k);
  return k;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  fs.mkdirSync(LOGOS_DIR,  { recursive: true });

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  // Collect unique URLs → stable filename keys
  const photoUrls = new Map(); // url → { label, key }
  const logoUrls  = new Map();
  const usedPhotoKeys = new Set();
  const usedLogoKeys  = new Set();

  for (const session of data) {
    const people = [
      ...(session.moderators         || []),
      ...(session.confirmed_speakers || []),
    ];
    for (const p of people) {
      if (p.photo_url && !photoUrls.has(p.photo_url)) {
        photoUrls.set(p.photo_url, {
          label: p.name,
          key:   uniqueKey(sanitize(p.name), usedPhotoKeys),
        });
      }
      if (p.company_logo_url && !logoUrls.has(p.company_logo_url)) {
        logoUrls.set(p.company_logo_url, {
          label: p.company,
          key:   uniqueKey(sanitize(p.company), usedLogoKeys),
        });
      }
    }
  }

  const photoLocal = new Map(); // original url → local relative path
  const logoLocal  = new Map();
  const failures   = [];

  // Download photos
  console.log(`\nDownloading ${photoUrls.size} photos...`);
  for (const [url, { label, key }] of photoUrls) {
    try {
      const dest = await download(url, path.join(PHOTOS_DIR, key));
      const rel  = `/images/speakers/photos/${path.basename(dest)}`;
      photoLocal.set(url, rel);
      console.log(`  ✓  ${label}`);
    } catch (e) {
      console.error(`  ✗  ${label}: ${e.message}`);
      failures.push({ type: 'photo', label, url, error: e.message });
    }
  }

  // Download logos
  console.log(`\nDownloading ${logoUrls.size} logos...`);
  for (const [url, { label, key }] of logoUrls) {
    try {
      const dest = await download(url, path.join(LOGOS_DIR, key));
      const rel  = `/images/speakers/logos/${path.basename(dest)}`;
      logoLocal.set(url, rel);
      console.log(`  ✓  ${label}`);
    } catch (e) {
      console.error(`  ✗  ${label}: ${e.message}`);
      failures.push({ type: 'logo', label, url, error: e.message });
    }
  }

  // Summary
  const photoOk = photoUrls.size - failures.filter(f => f.type === 'photo').length;
  const logoOk  = logoUrls.size  - failures.filter(f => f.type === 'logo').length;
  console.log('\n' + '─'.repeat(60));
  console.log(`Photos : ${photoOk}/${photoUrls.size} succeeded`);
  console.log(`Logos  : ${logoOk}/${logoUrls.size}  succeeded`);

  if (failures.length > 0) {
    console.log('\nFailed:');
    for (const f of failures) {
      console.log(`  [${f.type}] ${f.label}`);
      console.log(`          ${f.url}`);
      console.log(`          ${f.error}`);
    }
    console.log('\n⚠  Some downloads failed — JSON was NOT modified.');
    console.log('   Fix the failures above and re-run.\n');
    process.exit(1);
  }

  // All good — rewrite the JSON
  console.log('\nAll downloads succeeded. Rewriting default-list.json...');

  for (const session of data) {
    const people = [
      ...(session.moderators         || []),
      ...(session.confirmed_speakers || []),
    ];
    for (const p of people) {
      if (p.photo_url        && photoLocal.has(p.photo_url))        p.photo_url        = photoLocal.get(p.photo_url);
      if (p.company_logo_url && logoLocal.has(p.company_logo_url))  p.company_logo_url = logoLocal.get(p.company_logo_url);
    }
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log('✅  default-list.json updated with local paths.\n');
}

run().catch((e) => { console.error(e); process.exit(1); });
