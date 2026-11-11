# Read-only demo

The demo is the normal CodeAtlas frontend built as plain static files, with no API server or database behind it. It can be hosted anywhere that serves files, such as GitHub Pages.

Visitors can browse the repositories that were indexed when the demo was built: file list, source, definitions, symbol search, relationships, calls, the dependency graph, the architecture report, and impact for a single file. Indexing a repository, semantic search, questions, symbol-level impact, and pull request analysis need a server, so the demo explains that instead.

## How it works

`frontend/lib/demo-api.ts` stands in for the API. When `NEXT_PUBLIC_DEMO=1` at build time, `createApi` uses it in place of `fetch`. It answers the same `/api/...` requests from JSON files in `frontend/public/demo`, including paging, filters, and symbol search, which it runs in the browser with the same matching and ordering as the server.

## Rebuild it

1. Start the API and index the repositories you want to show. See the README.
2. Save what the demo needs:

   ```powershell
   node scripts/snapshot_demo.mjs http://127.0.0.1:8001
   ```

3. Build the static site. Pass the path it will be served from, or nothing for the root of a domain:

   ```powershell
   node scripts/build_demo.mjs /codeatlas
   ```

   In Git Bash, prefix the command with `MSYS_NO_PATHCONV=1` so the path is not rewritten.

4. Publish the contents of `frontend/out`.

The build sets `frontend/proxy.ts` aside while it runs, because the workspace password gate needs a server and Next.js will not export with it present. The file is put back afterwards, including when the build fails.

`frontend/public/demo` and `frontend/out` are generated and are not committed. Source links in the demo point at the commit that was indexed, so re-run the steps to show newer code.
