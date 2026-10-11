# ManageLove migration to Sudama Dokploy

Goal: Serve the existing website from the user's Sudama server, preserving accounts, profiles, photos, passwords and MFA.

Architecture: Keep the existing Vinext app and Worker request wrapper. Build a separate native Node entry with a Cloudflare binding shim and a SQLite D1 adapter. Use one application replica and a persistent database volume. Cloudflare may continue providing DNS, TLS and the existing server tunnel.

Tech stack: Existing pinned Vinext/Vite, Node 24, built-in node:sqlite, Docker, Dokploy.

## Constraints

- Never expose or commit credentials or database contents.
- Preserve the old service until the staged app and imported data pass verification.
- Preserve the existing MFA encryption key if any encrypted MFA records exist.
- Do not use Wrangler's development server as production hosting.
- User has authorized migration and requested autonomous execution.

## Tasks

1. Implement/test SQLite binding compatibility, including blobs, returning rows and atomic batch rollback.
2. Add a separate Node build and production entry; verify health, pages, request limits and session isolation.
3. Export the existing D1 database and retrieve required runtime secrets through authorized account access. Verify record counts and integrity.
4. Create a dedicated Dokploy project and Docker application with persistent storage. Deploy to a temporary host and verify.
5. Cut over only the website's routes/DNS after all checks pass. Retain rollback artifacts, verify the live origin, remove temporary database export access. Keep the requested Dokploy MCP connection scoped to the Sudama panel.

## Progress

- Dokploy MCP installed; dedicated Access service authentication configured and API connection verified.
- Dependencies installed; source branch codex/dokploy-sudama.
- Tasks 1–5 complete on 2026-10-11 UTC. Live apex and www route through the existing Sudama Cloudflare Tunnel to Dokploy/Traefik, then the Node application. Cloudflare continues providing DNS and public TLS.
- D1 exported three times with identical SHA-256; 7 accounts, 6 profiles, no enrolled MFA secrets. Existing password hashes and all table contents imported unchanged. A new MFA encryption key was generated because no source records depended on the old key.
- Dedicated `/data` volume and one replica verified. Restart after removing migration seed credentials retained 7 accounts and 6 profiles; SQLite integrity check passed.
- Native build, TypeScript, 3 SQLite/import tests and 300 independent portal checks passed. Live homepage, login page, assets, health and anonymous portal API return 200. HTTP/www canonical redirects passed. Browser language switching and profile rendering passed. No real account credentials were used to authenticate a user.
- Fixed the live tunnel/Traefik HTTPS boundary by reading Cloudflare visitor scheme only under the explicitly configured trusted tunnel mode; verified with a native HTTP request containing local HTTP forwarding and an HTTPS visitor scheme.
- Cloudflare Worker builds disabled, Workers URL disabled, and the two website Worker routes removed. The old Worker and D1 database are retained for recovery.
