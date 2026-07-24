# Terrace

**The stand settles itself.** World Cup prediction pools in USDC on Injective, settled by an autonomous referee agent that buys verified results over x402 for a few cents per call.

Every World Cup, groups of friends run prediction pools over group chats and spreadsheets, and every pool has the same weak point: someone has to hold the money and someone has to declare the result. Terrace removes both. Stakes sit in a contract on Injective EVM. At full time, an agent pays an x402-gated oracle for the verified score, settles the pool on-chain, and winners claim their share. Nobody's cousin is the bank.

Built for The Injective Global Cup, July 2026.

## How it works

```
fan wallets                    Terrace agent                 result oracle
    |                              |                              |
    |  join(pool, outcome)         |                              |
    |----------------------> TerracePool                          |
    |     (USDC escrow,            |                              |
    |      Injective EVM)          |  GET /result/{matchId}       |
    |                              |----------------------------->|
    |                              |  402 Payment Required        |
    |                              |<-----------------------------|
    |                              |  signed USDC payment (x402)  |
    |                              |----------------------------->|
    |                              |  verified final score        |
    |                              |<-----------------------------|
    |                              |                              |
    |                        settle(pool, outcome)                |
    |                              |                              |
    |  claim() -> winnings         |                              |
    |<-----------------------------|                              |
```

**Bounded authority.** The agent key can do exactly one thing: declare a winning outcome after a pool locks. It cannot move funds. Payouts flow only through winner-initiated `claim` and staker-initiated `refund`. If the agent goes silent for 48 hours, every staker refunds in full. If the agent declares an outcome nobody picked, the pool voids and every staker refunds in full. The agent's worst case is bounded by design.

## How the new Injective technologies are used

### x402
The result oracle (`oracle/`) gates `GET /result/:matchId` behind `injectivePaymentMiddleware` from [`@injectivelabs/x402`](https://www.npmjs.com/package/@injectivelabs/x402). Each verified result costs $0.05 in USDC, settled on Injective EVM in a single ~650ms block, with no API key and no account. The settlement agent (`agent/`) is the paying customer: it uses `createInjectiveClient` from the same library, receives the 402 quote, signs an EIP-3009 USDC authorization, and retries with the payment header. Machine pays machine, per call, with on-chain receipts. This is the exact agentic payment loop x402 on Injective was built for, exercised on both the server and client side.

### USDC CCTP
Everything in Terrace is denominated in native Circle USDC on Injective: pool stakes, payouts, and oracle payments are all the same asset. Because that USDC is CCTP-native, a fan holding USDC on Ethereum, Base, Solana, or any of the 20+ CCTP-supported chains can move it to Injective without bridges or wrapped tokens and stake directly. The frontend and the Agent Skill both direct cross-chain users to CCTP as the on-ramp. On testnet, USDC comes from [Circle's faucet](https://faucet.circle.com/).

### MCP Server
The contracts are deployed through the Injective MCP server workflow: with the MCP server connected in Claude Code, a coding agent references the Injective docs, deploys `TerracePool` and the stake token to Injective EVM, and verifies them, end to end from natural language (Route A in [DEPLOY.md](DEPLOY.md); a plain `viem` script is provided as Route B). The Terrace agent's on-chain settlement transactions can equally be routed through the MCP server's transaction tools, and the SKILL.md documents the contract surface in the form MCP-connected agents consume.

### Agent Skills
[`skills/terrace-settlement/SKILL.md`](skills/terrace-settlement/SKILL.md) is a portable Agent Skill that teaches any skill-capable coding agent to create pools, join them, buy paid results from the oracle, and settle, including the network table, the authority model to preserve, and the CCTP funding path. Drop the folder into a skills directory and an agent can operate Terrace without reading this repo.

## World Cup data

Results come from the public-domain [openfootball 2026 feed](https://github.com/openfootball/worldcup.json). `npm run sync` in `oracle/` refreshes `data/results.json`; at the time of writing it holds all 102 finished matches of the 2026 tournament, through the July 15 semifinal. `data/results.json` is the oracle's source of truth, so a manual entry can be added the moment a match ends, ahead of feed updates.

## Repository layout

```
contracts/   TerracePool.sol, MockUSDC.sol, compile script, ABI artifacts
oracle/      x402-gated result server (Express + @injectivelabs/x402)
agent/       autonomous settlement agent (TypeScript, viem, x402 client)
web/         frontend (Vite + React + viem), demo mode included
skills/      terrace-settlement Agent Skill
scripts/     deploy.mjs (viem, no Foundry needed), seed.mjs
submission/  X post draft, demo video script
```

## Run it

Prerequisites: Node 18+, a wallet with testnet INJ (gas) from the [Injective faucet](https://testnet.faucet.injective.network/) and testnet USDC from the [Circle faucet](https://faucet.circle.com/).

```bash
# 1. compile contracts and deploy (full runbook in DEPLOY.md)
npm install && node contracts/compile.mjs
DEPLOYER_PRIVATE_KEY=0x... AGENT_ADDRESS=0x... node scripts/deploy.mjs

# 2. oracle
cd oracle && npm install && npm run sync
FACILITATOR_PRIVATE_KEY=0x... npm start          # x402 paywall on
# or: npm run dev                                 # paywall off, local dev

# 3. agent
cd ../agent && npm install
POOL_ADDRESS=0x... AGENT_PRIVATE_KEY=0x... npm start

# 4. frontend
cd ../web && npm install
cp .env.example .env   # paste deployed addresses
npm run dev
```

With no `VITE_POOL_ADDRESS` set, the frontend runs in demo mode with sample pools built from real 2026 knockout fixtures, so the interface is fully explorable before deployment.

## Judging notes

Functional and usable: every component runs end to end on Injective EVM testnet. Lightweight: one contract, one server, one agent loop, one page. The four new Injective technologies each do a load-bearing job rather than a cameo: x402 is the agent's purchasing mechanism on both sides of the wire, CCTP USDC is the settlement asset everywhere, the MCP server is the deployment and transaction workflow, and the Agent Skill makes Terrace operable by other agents, which is where future contributions land.
