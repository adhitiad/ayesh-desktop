# Ayesh Desktop

Desktop client for Ayesh Multi-Agent AI Orchestrator.

## Stack

- **Runtime**: Electron 44 + React 19 + Vite 8 + TypeScript + Tailwind CSS v4
- **Package manager / scripts**: [Bun](https://bun.sh/) only (never npm/yarn)
- **Communication**: gRPC (`@grpc/grpc-js`) via Electron IPC bridge → ayesh-core `:50051`
- **Security**: contextIsolation + sandbox, strict CSP (build-time meta), deny window-open/navigation allowlist, masked API keys over IPC

## Backend deployment (remote-first)

Ayesh Desktop is a **thin client**. The backend (ayesh-core, Python gRPC server)
runs **remotely** — the desktop app connects to it via `grpc_host`/`grpc_port`:

- **Default (dev)**: `localhost:50051` — run ayesh-core on the same machine.
- **Remote**: run ayesh-core anywhere (VPS/docker), then set the address in
  **Settings → gRPC Host/Port**. The client reconnects automatically on save —
  no app restart needed. The server must be reachable and trusted (insecure
  credentials today; TLS is tracked as D5).

To deploy a backend, see the `ayesh-core` repository (`python bootstrap.py`,
`python main.py`; requires PostgreSQL + Redis + at least one LLM key in `.env`).

Bundling the backend as a local sidecar (Python + Postgres + Redis inside the
installer) is **not** planned for this release; it remains a possible P3 item.

## Quick Start (development)

```bash
# 1. Start the backend (terminal 1) — from ayesh-core/
python main.py            # gRPC :50051 + REST :8080 (needs Redis, PG, .env LLM key)

# 2. Install dependencies (terminal 2)
bun install

# 3. Start desktop in dev mode (Vite :5173 + Electron, NODE_ENV=development)
bun run dev
```

If the backend is not on `localhost:50051`, open **Settings** and set
`gRPC Host`/`gRPC Port`.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Vite dev server + Electron (development) |
| `bun run build` | Production build: renderer → `dist/` + installer → `release/` |
| `bun run build:renderer` | Vite build only (injects CSP meta) |
| `bun run package` | electron-builder only (packaging, no renderer build) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint 9 flat config over `src/` |
| `bun test` | Bun test suite (see `tests/`) |
| `bun run proto:generate` | Regenerate gRPC stubs (not required for normal dev — proto loaded at runtime) |

## IPC communication

```
Renderer → window.ayesh.* (preload.cjs) → ipcMain handlers → gRPC client → ayesh-core
```

All `ipcMain.handle` arguments are validated fail-closed in `src/main.js`;
path authorization remains the server's job (`_safe_path` in ayesh-core).

## Smoke test (packaged app)

With the backend running:

```bash
bun run build
# starts Ayesh.exe with a CDP port, asserts React mount + healthCheck + config + sessions
node scripts/smoke.cjs &
release/win-unpacked/Ayesh.exe --remote-debugging-port=9334
```

## Packaging & release

- Config: `electron-builder.yml` (single source; output `release/`).
- Targets: Windows NSIS, macOS DMG, Linux AppImage — icons in `assets/`.
- CI: `.github/workflows/ci.yml` — lint → typecheck → test → build on
  Windows/macOS/Linux, uploads artifacts, publishes a GitHub release on `v*` tags.
- Auto-update: `electron-updater` checks on start (production only).
- Code signing is optional: set `WINDOWS_CSC_LINK` / `MAC_CSC_LINK` repo
  secrets to sign; unsigned builds show SmartScreen/notarization warnings.
  Bypass without a certificate: Windows → "More info" → "Run anyway";
  macOS → right-click → Open (or System Settings → Privacy & Security →
  Open Anyway). Publish SHA256 checksums in release notes.

## Features

- Chat streaming with interrupt (bidirectional stream per session)
- Sessions list + detail + open in chat
- Files browser (read/write via server-side path checks)
- Skills management
- Settings (provider/model/REST/gRPC + masked API key)
- Health check (Postgres/Redis status)

## Cross-platform

- Windows (NSIS) · macOS (DMG) · Linux (AppImage)
