#!/usr/bin/env node
// Merge emergent topic: bins that name the same issue (sources/comments/topic-merges.json) across the
// v2 comment summaries. Only keys change; each bin keeps its own name, description and quotes. A merge that
// would leave two bins on one key in the same letter is skipped for that letter and reported.
//
//   node tools/merge-topics.mjs           apply the merges
//   node tools/merge-topics.mjs --check   exit 1 if any summary still carries a key that should be merged
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "sources", "comments", "summaries-v2");
export const MERGES = JSON.parse(readFileSync(join(ROOT, "sources", "comments", "topic-merges.json"), "utf8")).merges;

// Returns { summary, renamed, skipped } for one parsed summary; `summary` is a new object.
export function mergeOne(s) {
  const keys = new Set(s.bins.map((b) => b.key));
  const to = new Map(), skipped = [];
  for (const b of s.bins) {
    const t = MERGES[b.key];
    if (!t) continue;
    // Another bin in this letter already has (or will have) the target key: keep both apart.
    if (keys.has(t) || [...to.values()].includes(t)) { skipped.push(b.key + " -> " + t); continue; }
    to.set(b.key, t);
  }
  const mapKey = (k) => to.get(k) || k;
  const summary = { ...s, bins: s.bins.map((b) => ({ ...b, key: mapKey(b.key) })), quotes: s.quotes.map((q) => ({ ...q, bins: q.bins ? q.bins.map(mapKey) : q.bins })) };
  return { summary, renamed: to.size, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes("--check");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
  if (!files.length) { console.error("✗ no summaries in " + DIR); process.exit(2); }
  let renamed = 0, changed = 0; const skipped = [];
  for (const f of files) {
    const raw = readFileSync(join(DIR, f), "utf8");
    const r = mergeOne(JSON.parse(raw));
    r.skipped.forEach((x) => skipped.push(f + ": " + x));
    if (!r.renamed) continue;
    renamed += r.renamed; changed++;
    if (!check) writeFileSync(join(DIR, f), JSON.stringify(r.summary, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
  }
  skipped.forEach((x) => console.log("  kept apart (same letter already has the target): " + x));
  if (check) {
    if (renamed) { console.error(`✗ ${renamed} topic key(s) in ${changed} summaries still need merging: node tools/merge-topics.mjs`); process.exit(1); }
    console.log(`✓ ${files.length} summaries checked, ${Object.keys(MERGES).length} merges applied, ${skipped.length} kept apart`);
  } else console.log(`✓ ${renamed} bin key(s) merged in ${changed} of ${files.length} summaries · ${skipped.length} kept apart`);
}
