// Saves everything the read-only demo needs from a running CodeAtlas API
// into frontend/public/demo, as plain JSON files.
//
//   node scripts/snapshot_demo.mjs [api-url]
//
// Index the repositories you want in the demo first. See docs/demo.md.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = (process.argv[2] || "http://127.0.0.1:8001").replace(/\/$/, "");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend", "public", "demo");

async function get(path) {
  const response = await fetch(API + path);
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`);
  return response.json();
}
async function post(path, body) {
  const response = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok ? response.json() : null;
}
// Follows offset paging until every item has been read.
async function all(path, limit, pick = (page) => page.items) {
  const items = [];
  let first = null;
  for (let offset = 0; ; offset += limit) {
    const page = await get(`${path}${path.includes("?") ? "&" : "?"}limit=${limit}&offset=${offset}`);
    first ??= page;
    const batch = pick(page);
    items.push(...batch);
    if (batch.length < limit) break;
  }
  return { first, items };
}
let bytes = 0;
async function save(name, data) {
  const text = JSON.stringify(data);
  bytes += text.length;
  const path = join(OUT, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

await rm(OUT, { recursive: true, force: true });
const repositories = (await get("/repositories")).filter((repo) => repo.status === "parsed");
if (!repositories.length) throw new Error("No parsed repositories. Index at least one first.");
const base = { capabilities: await get("/capabilities"), repositories, repos: {} };

for (const repo of repositories) {
  const id = repo.id;
  const files = await get(`/repositories/${id}/files`);
  base.repos[id] = {
    overview: await get(`/repositories/${id}/overview`),
    files,
    architecture: await get(`/repositories/${id}/architecture`).catch(() => null),
  };

  // Every definition, for search and symbol lookups.
  const symbols = (await all(`/repositories/${id}/symbols`, 500, (page) => page)).items;
  const parses = await get(`/repositories/${id}/parse/files`);
  await save(`r${id}/symbols.json`, {
    symbols,
    parseErrors: parses.filter((parse) => parse.has_parse_errors).map((parse) => parse.file_id),
  });

  for (const file of files) {
    const root = `/repositories/${id}/files/${file.id}`;
    const detail = await all(root, 500, (page) => page.symbols.items);
    const calls = await all(`${root}/calls`, 100);
    const relationships = {};
    for (const kind of ["imports", "contains"])
      for (const direction of ["outgoing", "incoming"]) {
        const pages = await all(`${root}/relationships?kind=${kind}&direction=${direction}`, 100);
        relationships[`${kind}|${direction}`] = { ...pages.first, items: pages.items, total: pages.items.length };
      }
    await save(`r${id}/f${file.id}.json`, {
      detail: { ...detail.first, symbols: { ...detail.first.symbols, items: detail.items, total: detail.items.length } },
      graph: await get(`${root}/graph`),
      calls: { ...calls.first, items: calls.items },
      relationships,
      impact: await post(`/repositories/${id}/impact`, { file_ids: [file.id], symbol_ids: [] }),
    });
  }
  console.log(`${repo.owner}/${repo.name}: ${files.length} files, ${symbols.length} symbols`);
}
await save("base.json", base);
console.log(`Wrote ${OUT} (${(bytes / 1048576).toFixed(1)} MB)`);
