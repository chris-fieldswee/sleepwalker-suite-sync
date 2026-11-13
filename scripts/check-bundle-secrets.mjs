#!/usr/bin/env node
// Fails the build when a server credential ends up in the browser bundle:
// a Supabase JWT whose role is not "anon", or a new-style secret key (sb_secret_...).
// Run after `vite build`; scans every text asset in dist/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const JWT = /eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g;
const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{10,}/g;
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.map', '.txt', '.webmanifest']);

const decodeRole = (payload) => {
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
};

/** Returns a description of every server credential found in `text` (never the value itself). */
export function findSecrets(text) {
  const findings = [];
  for (const match of text.matchAll(JWT)) {
    const role = decodeRole(match[1]);
    if (role && role !== 'anon') findings.push(`JWT with role "${role}"`);
  }
  if (SECRET_KEY.test(text)) findings.push('Supabase secret key (sb_secret_...)');
  SECRET_KEY.lastIndex = 0;
  return findings;
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dist = process.argv[2] || 'dist';
  let failed = false;
  for (const file of walk(dist).filter((f) => TEXT_EXTENSIONS.has(extname(f)))) {
    for (const finding of findSecrets(readFileSync(file, 'utf8'))) {
      console.error(`✖ ${finding} found in ${file}`);
      failed = true;
    }
  }
  if (failed) {
    console.error('Build blocked: a server credential is in the public bundle. Remove any VITE_-prefixed secret.');
    process.exit(1);
  }
  console.log('✔ No server credentials in the bundle.');
}
