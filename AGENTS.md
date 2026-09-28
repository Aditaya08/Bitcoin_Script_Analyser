# ScriptScope — Agent Instructions

## Project Overview
Bitcoin transaction script analyzer ("ScriptScope") — monorepo with Turborepo + npm workspaces + Cargo workspace.

| Package | Language | Stack | Port |
|---------|----------|-------|------|
| `packages/api` | Rust | Axum, Tokio, bitcoin crate | 4000 |
| `packages/core` | Rust | WASM (wasm-bindgen), bitcoin, secp256k1 | — |
| `packages/web` | TypeScript | React 18, Vite 5, Tailwind 3 | 5173 |

## Commands (run from repo root)

```bash
# Install all deps
npm install

# Dev: runs api + web in parallel (needs two terminals)
npm run dev          # or: turbo run dev --parallel

# Build all packages
npm run build        # turbo run build

# Type-check all
npm run typecheck    # turbo run typecheck

# Test all
npm run test         # turbo run test

# Single package
cd packages/api && cargo run       # dev
cd packages/api && cargo build --release
cd packages/api && cargo test
cd packages/web && npm run dev
cd packages/web && npm run build
cd packages/web && npm run typecheck
```

## Key Architecture Notes

- **WASM build**: `packages/core` compiles to `packages/web/src/wasm/btc-core/` via `wasm-pack` (not in npm scripts — check CI/local setup)
- **API proxy**: Vite proxies `/api/*` → `http://localhost:4000` (see `packages/web/vite.config.ts`)
- **Shared types**: Core exposes `DebugStep`, `ScriptType`, etc. via wasm-bindgen; web imports from `@/lib/wasm`
- **Debugger engine**: 50+ opcodes in `packages/core/src/debugger/` — flow control, stack, arithmetic, crypto, sig verification
- **Script classification**: `packages/core/src/classifiers/` — detects P2PKH, P2SH, P2WPKH, P2WSH, P2TR, P2MS, OP_RETURN

## Conventions

- **Rust**: 2021 edition, workspace deps in root `Cargo.toml`, `thiserror` for errors
- **TypeScript**: Strict mode, path alias `@` → `packages/web/src`
- **Tailwind**: Custom design tokens in `tailwind.config.ts` (colors, fonts, spacing) — "Cryptographic Brutalist" theme
- **API routes**: `/api/tx/:txid`, `/api/tx/:txid/input/:index`, `/api/tx/:txid/output/:index`, `/api/script/classify`, `/api/script/debug`, `/health`

## Common Gotchas

- **WASM not rebuilt**: After core changes, re-run `wasm-pack build --target web --out-dir ../../web/src/wasm/btc-core` in `packages/core`
- **Port conflicts**: Kill stale `cargo run` on 4000 / Vite on 5173
- **No lint configured**: `npm run lint` is a no-op (echo only)
- **No tests in web**: `npm test` echoes "no tests configured"

## Environment

- Node ≥ 18, npm ≥ 9
- Rust toolchain (stable)
- No `.env` required — Blockstream API is public