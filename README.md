# ScriptScope

> A browser-based Bitcoin transaction script analyzer and debugger, inspired by [btcdeb](https://github.com/bitcoin-core/btcdeb).

ScriptScope lets you paste any Bitcoin transaction ID, dissect its inputs and outputs, identify script types, and step through opcode execution in a visual debugger — all from a sleek, dark "X-Ray" interface.

---

## Features

- **Transaction Analysis** — Fetch and decode any Bitcoin transaction by TXID via [Blockstream API](https://blockstream.info)
- **Script Classification** — Auto-detect P2PKH, P2SH, P2WPKH, P2WSH, P2TR (Taproot), P2MS, OP_RETURN
- **Interactive Stack Debugger** — Step through opcodes one-by-one, watch the stack evolve, see verification results
- **Taproot Inspector** — Decode Schnorr signatures, key paths, script paths, and control blocks
- **OP_RETURN Decoder** — Detect Ordinals/Runes and OMNI protocols in data outputs
- **X-Ray UI** — Deep-black canvas with animated Digital Loom threads, glassmorphic panels, JetBrains Mono typography

---

## Architecture

```
scriptscope/
├── packages/
│   ├── api/          ← Express + TypeScript backend (port 4000)
│   └── web/          ← React + Vite + Tailwind frontend (port 5173)
├── package.json      ← npm workspaces
└── turbo.json        ← Turborepo config
```

| Layer | Stack | Purpose |
|-------|-------|---------|
| **Backend** | Express, TypeScript, bitcoinjs-lib, tiny-secp256k1 | Fetch raw tx, classify scripts, run opcode debugger |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, Framer Motion, Lucide Icons | Render X-Ray UI with live transaction data |

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

---

## Quick Start

### 1. Install dependencies

```bash
cd scriptscope
npm install
```

### 2. Start both services

Open **two terminals**:

**Terminal 1 — Backend API:**
```bash
cd packages/api
npm run dev
```
> Express server starts on `http://localhost:4000` with hot-reload (`tsx watch`)

**Terminal 2 — Frontend:**
```bash
cd packages/web
npm run dev
```
> Vite dev server starts on `http://localhost:5173` with HMR

### 3. Open the app

Navigate to **http://localhost:5173** in your browser.

---

## Usage

1. Paste a **Bitcoin Transaction ID** into the search bar
2. Click **Analyze** — the backend fetches the raw transaction from Blockstream
3. Inspect the decoded inputs, outputs, script types, and witness data
4. Click **Debug** on any input to launch the **Stack Debugger**
5. Step through opcodes with **Prev / Next**, watch the stack in real-time

### Example TXIDs

| Script Type | TXID |
|-------------|------|
| P2PKH (Legacy) | `a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d` |
| P2WPKH (SegWit) | `f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16` |
| P2TR (Taproot) | `33e794d097969002ee05d336686fc03c9e9a73215e9da48c66e6acca57889534` |

---

## API Reference

All endpoints are served from the backend on port `4000`. The Vite dev server proxies `/api/*` automatically.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tx/:txid` | Full transaction analysis |
| `GET` | `/api/tx/:txid/input/:index` | Single input analysis |
| `GET` | `/api/tx/:txid/output/:index` | Single output analysis |
| `POST` | `/api/script/classify` | Classify a script hex → type + ASM |
| `POST` | `/api/script/debug` | Step-by-step opcode debugger |
| `GET` | `/health` | Health check |

### POST `/api/script/debug`

```json
{
  "scriptSig": "483045022100...",
  "scriptPubKey": "76a914...",
  "witness": ["3044...", "0279..."]
}
```

**Response:** Array of `DebugStep` objects with `opcode`, `stackBefore`, `stackAfter`, and `error` fields.

---

## Project Structure

```
packages/api/src/
├── server.ts          ← Express app (port 4000)
├── routes.ts          ← API route handlers
├── fetcher.ts         ← Blockstream API client
├── classifier.ts      ← Script type detection engine
├── debugger.ts        ← Opcode execution simulator
├── taproot.ts         ← Taproot-specific analysis
└── types.ts           ← Shared TypeScript interfaces

packages/web/src/
├── main.tsx            ← React entry point
├── App.tsx             ← Main layout (sidebar + header + content)
├── types.ts            ← Frontend type definitions
├── styles/index.css    ← Global CSS (dark theme, fonts, scrollbars)
├── context/
│   └── TxContext.tsx    ← Global state for tx analysis & debugger
├── components/
│   ├── TxSearch.tsx        ← Glassmorphic search bar
│   ├── StackDebugger.tsx   ← Interactive opcode step-through
│   ├── OpcodeRef.tsx       ← Collapsible opcode reference table
│   ├── ScriptPanel.tsx     ← Script hex/ASM display
│   ├── TxOverview.tsx      ← Transaction summary
│   └── ui/                 ← Reusable primitives
│       └── digital-loom-background.tsx  ← Animated canvas
├── hooks/
│   └── useCopyToClipboard.ts
└── lib/
    ├── api.ts          ← Fetch helpers
    └── utils.ts        ← cn() Tailwind merge utility
```

---

## Available Scripts

From **each package directory**:

### `packages/api`

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot-reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled build |
| `npm test` | Run Jest tests |
| `npm run typecheck` | Type-check only (no emit) |

### `packages/web`

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Type-check only (no emit) |

---

## Design System

The UI follows a **"Cryptographic Brutalist"** aesthetic:

| Token | Value | Usage |
|-------|-------|-------|
| Canvas | `#0c0f0f` | Base background |
| Primary | `#c1c1ff` | Active states, links |
| Primary Container | `#8183ff` | Buttons, accents |
| Secondary | `#c8c3e1` | Output panels |
| Tertiary | `#ffb689` | Taproot badges |
| Error | `#ffb4ab` | Failed verifications |
| Body Font | Inter | UI text |
| Code Font | JetBrains Mono | Data, opcodes, hashes |

**Effects:** Glassmorphism (`bg-black/60 backdrop-blur-md`), animated Digital Loom canvas threads, custom neon scrollbars.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| IDE shows stale type errors | `Ctrl+Shift+P` → "TypeScript: Restart TS Server" |
| Port already in use | Vite auto-increments; check terminal for actual port |
| API connection refused | Ensure `packages/api` is running on port 4000 |
| Canvas threads not visible | Hard refresh (`Ctrl+Shift+R`) |

---

## License

MIT
