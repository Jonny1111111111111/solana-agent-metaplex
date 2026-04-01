# Agent Economy

> **Solana Agent Economy Hackathon — Metaplex Track**
>
> Two autonomous on-chain agents with verifiable identities, sovereign wallets, and a fair-launch token — built entirely on Metaplex primitives.

## What This Demonstrates

| Hackathon Requirement | Implementation |
|---|---|
| Register agent on Solana | MPL Core asset + `registerIdentityV1` (AgentIdentity plugin) |
| On-chain wallet & identity | Asset Signer PDA + ERC-8004 registration document on Arweave |
| Launch token | Metaplex Genesis fair-launch pool (AGNT, 1T supply) |
| A2A interactions | Both agent wallets deposit SOL into shared Genesis pool, verifiable on-chain |
| Token utility | AGNT as registration stake + governance token (application-layer checks on devnet) |
| Execution delegation | Executive pattern — off-chain operator controls agents via delegated Execute hook |

## Architecture

```
Owner Wallet
├── MPL Core Collection ("Agent Economy Collective")
│   ├── Agent Alpha (MPL Core Asset)
│   │   ├── AgentIdentity plugin → Arweave ERC-8004 doc
│   │   ├── Asset Signer PDA ← agent's sovereign on-chain wallet
│   │   └── ExecutionDelegateRecord → Executive Profile
│   └── Agent Beta (MPL Core Asset)
│       ├── AgentIdentity plugin → Arweave ERC-8004 doc
│       ├── Asset Signer PDA ← agent's sovereign on-chain wallet
│       └── ExecutionDelegateRecord → Executive Profile

Executive Wallet
└── ExecutiveProfileV1 PDA (one-time setup)
    ├── Can operate Agent Alpha via Execute hook
    └── Can operate Agent Beta via Execute hook

Genesis Token Launch (AGNT)
├── GenesisAccountV2 (mint + config)
├── LaunchPoolBucketV2 (deposit window → proportional distribution)
│   ├── Agent Alpha deposits 0.1 SOL → deposit PDA (on-chain proof)
│   └── Agent Beta deposits 0.1 SOL  → deposit PDA (on-chain proof)
└── UnlockedBucketV2 (receives 100% of collected SOL after crank)
```

## Quick Start

```bash
git clone https://github.com/Jonny1111111111111/solana-agent-metaplex.git
cd solana-agent-metaplex
npm install
cp .env.example .env        # Uses devnet by default

# Run all 8 steps in order:
npm run setup               # Generate wallets, airdrop devnet SOL
npm run create-agents       # Create MPL Core collection + 2 agent assets
npm run register            # Register on-chain identities (ERC-8004 → Arweave)
npm run launch-token        # Launch AGNT token via Genesis fair-launch pool
npm run executive           # Register executive, delegate execution to both agents
npm run a2a                 # A2A demo — both agents deposit into the launch pool
# ... wait for deposit window to close (configurable, default 60 min) ...
npm run crank               # Crank state machine + claim AGNT tokens
npm run demo                # Print judge-friendly summary with explorer links
```

## Scripts

| # | Script | What It Does |
|---|---|---|
| 01 | `setup` | Generate owner + executive keypairs, airdrop devnet SOL, top-up balances |
| 02 | `create-agents` | Upload metadata to Irys, create MPL Core collection + Agent Alpha + Agent Beta |
| 03 | `register` | Build ERC-8004 identity docs, upload to Arweave, call `registerIdentityV1` |
| 04 | `launch-token` | Initialize Genesis, add LaunchPool + Unlocked buckets with time conditions, finalize |
| 05 | `executive` | `registerExecutiveV1` + `delegateExecutionV1` for both agents (idempotent) |
| 06 | `a2a` | Each agent wraps SOL + deposits into Genesis pool (atomic tx), prints A2A proof log |
| 07 | `crank` | `triggerBehaviorsV2` (move SOL to unlocked bucket) + `claimLaunchPoolV2` per agent |
| 08 | `demo` | Read-only summary — fetches live on-chain state, prints explorer links |

## Key Concepts

### Asset Signer PDA
Every MPL Core asset has a built-in on-chain wallet — a PDA derived from the asset's public key. No private key exists. Only the MPL Core Execute hook can spend from it, and only when invoked by a delegated executive. This gives each agent a **sovereign wallet** controlled by on-chain rules, not by any single key holder.

### Executive Delegation
The owner creates an `ExecutiveProfileV1` for an off-chain operator wallet, then an `ExecutionDelegateRecordV1` per agent. The executive can then sign transactions on behalf of each agent without holding any of the agent's assets.

### ERC-8004 Registration
Each agent's identity document is stored permanently on Arweave (via Irys). It describes the agent's name, supported services (A2A protocol, MCP), trust models, and a pointer back to its on-chain registry. This makes agent discovery and verification possible across systems.

### Genesis Fair Launch
Metaplex Genesis provides fully on-chain token launches. A deposit window opens for a configurable duration; participants deposit SOL. When the window closes, tokens are distributed proportionally. All rules are enforced on-chain — no admin keys, no rugs.

### Token Utility (Proof-of-Concept)

AGNT is not just a fair-launch token — it plays a functional role in the Agent Economy:

- **Registration Staking:** Agents must hold a minimum AGNT balance to register on the platform. This creates a cost barrier that prevents spam registrations and aligns agent incentives with the ecosystem's health. In a production system, the staked AGNT would be slashable if an agent behaves maliciously.
- **Governance:** AGNT holders can vote on platform-level decisions — such as which new agent capabilities to approve, fee structures, and protocol upgrades. Governance weight is proportional to each agent's AGNT balance (1 token = 1 vote).

> **Note:** This is a devnet proof-of-concept. The staking check and governance voting are demonstrated at the application layer (off-chain logic that reads on-chain token balances). A production version would enforce these rules via dedicated on-chain programs.

## Project Structure

```
agent-economy/
├── scripts/
│   ├── 01-setup.ts          — Wallet generation & funding
│   ├── 02-create-agents.ts  — MPL Core collection + assets
│   ├── 03-register-agents.ts — ERC-8004 identity registration
│   ├── 04-launch-token.ts   — Genesis fair-launch pool
│   ├── 05-executive.ts      — Executive delegation
│   ├── 06-a2a-demo.ts       — Agent deposits (A2A proof)
│   ├── 07-crank-claim.ts    — Crank + claim tokens
│   ├── 08-full-demo.ts      — Summary for judges
│   ├── umi.ts               — UMI initialization helpers
│   ├── state.ts             — State persistence between scripts
│   └── registry.ts          — Re-exports from mpl-agent-registry
├── state/
│   └── deployed.json        — Addresses from previous runs (gitignored)
├── keypairs/                 — Owner + executive keys (gitignored)
├── .env.example              — Environment template
├── package.json
└── tsconfig.json
```

## Tech Stack

| Package | Role |
|---|---|
| `@metaplex-foundation/mpl-core` | NFT standard — Core assets + Asset Signer PDAs |
| `@metaplex-foundation/mpl-agent-registry` | Agent identity + executive delegation |
| `@metaplex-foundation/genesis` | Token launch pools (fair-launch) |
| `@metaplex-foundation/umi` | Solana transaction builder |
| `@metaplex-foundation/umi-uploader-irys` | Arweave metadata upload |
| `@solana/web3.js` | Low-level Solana RPC |

## Network

All scripts target **Solana Devnet** by default. Set `RPC_URL` in `.env` to change.

## License

MIT
