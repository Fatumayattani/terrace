/**
 * Sync results.json from the openfootball public-domain World Cup 2026 feed.
 * Match IDs are stable slugs: wc2026-<team1>-<team2>-<date>.
 * results.json remains the oracle's source of truth; this script only writes
 * finished matches (full-time score present). Run: npm run sync
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const FEED =
  process.env.WC_FEED_URL ||
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "..", "data", "results.json");

const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

const res = await fetch(FEED);
if (!res.ok) {
  console.error(`feed fetch failed: ${res.status}`);
  process.exit(1);
}
const feed = await res.json();

let existing = {};
try {
  existing = JSON.parse(readFileSync(out, "utf8"));
} catch {}

let added = 0;
for (const m of feed.matches || []) {
  const ft = m.score?.ft;
  if (!Array.isArray(ft) || ft.length !== 2) continue; // not finished
  const id = `wc2026-${slug(m.team1)}-${slug(m.team2)}-${m.date}`;
  existing[id] = {
    title: `${m.team1} v ${m.team2} (${m.round}, ${m.date})`,
    finished: true,
    homeScore: ft[0],
    awayScore: ft[1],
    source: "openfootball/worldcup.json",
  };
  added++;
}

writeFileSync(out, JSON.stringify(existing, null, 2));
console.log(`synced ${added} finished matches -> data/results.json (${Object.keys(existing).length} total)`);
