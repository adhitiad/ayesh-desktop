# Ayesh Desktop

Desktop application for Ayesh Multi-Agent AI Orchestrator.

## Architecture

- **Frontend**: Electron 31 + React 18 + TypeScript + Tailwind CSS
- **Communication**: gRPC via `@grpc/grpc-js` + Electron IPC bridge
- **Backend**: ayesh-core (Python gRPC server on :50051)

## Quick Start

```bash
# Install dependencies
npm install

# Generate proto stubs
npm run proto:generate

# Start in development mode
npm run dev

# Build for production
npm run build
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Electron + Vite dev server |
| `npm run build` | Build for production |
| `npm run pack` | Package without building |
| `npm run proto:generate` | Generate gRPC stubs from .proto |

## IPC Communication

```
Renderer → window.ayesh.* → preload.js → ipcMain → gRPC Client → ayesh-core :50051
```

## Features

- Chat streaming (bidirectional)
- File browser & editor
- Skills management
- Session management
- Config/settings
- Health check

## Cross-platform

- Windows (NSIS)
- macOS (DMG)
- Linux (AppImage)
