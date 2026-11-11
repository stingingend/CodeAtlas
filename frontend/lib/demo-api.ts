// A stand-in for the CodeAtlas API used by the read-only demo build.
//
// It answers the same `/api/...` requests as the real server, from JSON files
// written by scripts/snapshot_demo.mjs. Reading works; anything that would
// change the index or needs the server (indexing, semantic search, questions,
// pull requests) returns an explanation instead. See docs/demo.md.

const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/demo`;
const READ_ONLY =
  "This is a read-only demo, so indexing is turned off. Run CodeAtlas yourself to index your own repository.";
const NEEDS_SERVER =
  "The read-only demo has no server behind it, so this feature is not available here. Run CodeAtlas yourself to use it.";

type Json = Record<string, any>;
const cache = new Map<string, Promise<Json>>();

function load(name: string): Promise<Json> {
  let pending = cache.get(name);
  if (!pending) {
    pending = fetch(`${BASE}/${name}`).then((response) => {
      if (!response.ok) throw new Error(`Missing demo data: ${name}`);
      return response.json();
    });
    pending.catch(() => cache.delete(name));
    cache.set(name, pending);
  }
  return pending;
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const refuse = (detail: string, status = 403) => reply({ detail }, status);
const page = <T>(items: T[], params: URLSearchParams, fallback: number) => {
  const limit = Number(params.get("limit")) || fallback;
  const offset = Number(params.get("offset")) || 0;
  return { items: items.slice(offset, offset + limit), limit, offset };
};

async function search(id: string, params: URLSearchParams) {
  const base = await load("base.json");
  const repo = base.repos[id];
  if (!repo) return refuse("Repository not found.", 404);
  const { symbols, parseErrors } = await load(`r${id}/symbols.json`);
  const paths = new Map<number, string>(repo.files.map((file: Json) => [file.id, file.path]));
  const query = (params.get("q") || "").trim();
  if (!query) return refuse("Enter a non-empty search term.", 422);
  const needle = query.toLowerCase();
  const kind = params.get("kind");
  // Same matching and ordering as the server: exact name, then prefix, then the rest.
  const rank = (symbol: Json) => {
    const name = symbol.name.toLowerCase();
    return name === needle ? 0 : name.startsWith(needle) ? 1 : 2;
  };
  const matches = (symbols as Json[])
    .filter(
      (symbol) =>
        (!kind || symbol.symbol_type === kind) &&
        [symbol.name, symbol.qualified_name, symbol.signature, paths.get(symbol.file_id) || ""].some(
          (text) => String(text).toLowerCase().includes(needle),
        ),
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (paths.get(a.file_id) || "").localeCompare(paths.get(b.file_id) || "") ||
        a.start_line - b.start_line ||
        a.id - b.id,
    );
  const slice = page(matches, params, 20);
  return reply({
    repository_id: Number(id),
    query,
    parsed: true,
    commit_sha: repo.overview.snapshot?.commit_sha ?? null,
    total: matches.length,
    ...slice,
    items: slice.items.map((symbol) => ({
      symbol,
      path: paths.get(symbol.file_id),
      has_parse_errors: parseErrors.includes(symbol.file_id),
    })),
  });
}

async function symbolDetail(id: string, symbolId: number) {
  const { symbols, parseErrors } = await load(`r${id}/symbols.json`);
  const symbol = (symbols as Json[]).find((item) => item.id === symbolId);
  if (!symbol) return refuse("Symbol not found in this repository.", 404);
  const { detail } = await load(`r${id}/f${symbol.file_id}.json`);
  const lines = `#L${symbol.start_line}-L${symbol.end_line}`;
  return reply({
    symbol,
    file: detail.file,
    source: detail.source.split("\n").slice(symbol.start_line - 1, symbol.end_line).join("\n"),
    commit_sha: detail.commit_sha,
    has_parse_errors: parseErrors.includes(symbol.file_id),
    github_url: `${detail.github_url.split("#")[0]}${lines}`,
  });
}

async function fileRoute(id: string, fileId: string, rest: string, params: URLSearchParams) {
  let data: Json;
  try {
    data = await load(`r${id}/f${fileId}.json`);
  } catch {
    return refuse("File not found in this repository.", 404);
  }
  if (rest === "") {
    const slice = page(data.detail.symbols.items, params, 100);
    return reply({ ...data.detail, symbols: { ...slice, total: data.detail.symbols.total } });
  }
  if (rest === "graph") return reply(data.graph);
  if (rest === "calls") {
    const resolution = params.get("resolution");
    const items = resolution
      ? data.calls.items.filter((call: Json) => call.resolution === resolution)
      : data.calls.items;
    return reply({ ...data.calls, ...page(items, params, 30), total: items.length });
  }
  if (rest === "relationships") {
    const direction = params.get("direction") || "outgoing";
    const kind = params.get("kind");
    const sets = kind ? [`${kind}|${direction}`] : [`contains|${direction}`, `imports|${direction}`];
    const first = data.relationships[sets[0]];
    const items = sets.flatMap((key) => data.relationships[key]?.items ?? []);
    return reply({ ...first, ...page(items, params, 30), total: items.length });
  }
  return refuse("Not found.", 404);
}

async function route(path: string, params: URLSearchParams, method: string, body: Json | null) {
  const base = await load("base.json");
  if (path === "/capabilities") return reply({ ...base.capabilities, generation_configured: false });
  if (path === "/ready") return reply({ status: "ready" });
  if (path === "/jobs") return reply([]);
  if (path.startsWith("/jobs/")) return refuse("Indexing job not found.", 404);
  if (path === "/repositories")
    return method === "GET" ? reply(base.repositories) : refuse(READ_ONLY);

  const match = path.match(/^\/repositories\/(\d+)(?:\/(.*))?$/);
  if (!match) return refuse("Not found.", 404);
  const [, id, tail = ""] = match;
  const repo = base.repos[id];
  if (!repo) return refuse("Repository not found.", 404);

  if (method !== "GET") {
    // The one write-shaped request the demo can answer: impact of a single file.
    if (tail === "impact" && body?.file_ids?.length === 1 && !body.symbol_ids?.length) {
      const data = await load(`r${id}/f${body.file_ids[0]}.json`).catch(() => null);
      if (data?.impact) return reply(data.impact);
    }
    if (["ingest", "parse", "jobs"].includes(tail)) return refuse(READ_ONLY);
    return refuse(NEEDS_SERVER);
  }
  if (tail === "overview") return reply(repo.overview);
  if (tail === "files") return reply(repo.files);
  if (tail === "architecture")
    return repo.architecture ? reply(repo.architecture) : refuse(NEEDS_SERVER);
  if (tail === "semantic") return reply({ ready: false, document_count: 0, model: "" });
  if (tail === "semantic/search") return refuse(NEEDS_SERVER);
  if (tail === "pull-requests") return reply([]);
  if (tail === "search") return search(id, params);
  const symbol = tail.match(/^symbols\/(\d+)$/);
  if (symbol) return symbolDetail(id, Number(symbol[1]));
  const file = tail.match(/^files\/(\d+)(?:\/(.*))?$/);
  if (file) return fileRoute(id, file[1], file[2] ?? "", params);
  return refuse("Not found.", 404);
}

// Called once by the workspace page in a demo build, before any request is made.
export function installDemoApi() {
  (globalThis as { codeatlasDemoFetch?: typeof fetch }).codeatlasDemoFetch = demoFetch;
}

export const demoFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input), "http://demo.invalid");
  const path = url.pathname.replace(/^\/api/, "");
  const method = (init?.method || "GET").toUpperCase();
  let body: Json | null = null;
  if (typeof init?.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = null;
    }
  }
  return route(path, url.searchParams, method, body);
};
