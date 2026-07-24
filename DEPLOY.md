# Deploying Terrace

Target network: Injective EVM Testnet, chain ID 1439, RPC `https://k8s.testnet.json-rpc.injective.network`, explorer `https://testnet.blockscout.injective.network`. Mainnet (1776) works identically with `INJECTIVE_NETWORK=mainnet`.

## 0. Wallets and funding

You need three keys. One key can play all three roles on testnet, but separate keys make the demo story cleaner.

| Role | Needs |
|---|---|
| Deployer | testnet INJ for gas |
| Agent (referee) | testnet INJ for settle gas, testnet USDC to pay the oracle |
| Fan wallet(s) | testnet INJ for gas, testnet USDC to stake |

- INJ: https://testnet.faucet.injective.network/
- USDC: https://faucet.circle.com/ (select Injective testnet). Testnet USDC is `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d`.

## 1. Compile

```bash
npm install
node contracts/compile.mjs
```

Artifacts land in `contracts/out/`.

## 2. Deploy

### Route A: Injective MCP server (the submission story)

In Claude Code with the Injective MCP server connected and the `injective-evm-developer` Agent Skill installed, prompt:

> Deploy contracts/out/TerracePool.json to Injective EVM testnet with constructor args (stakeToken: 0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d, agent: <AGENT_ADDRESS>), then verify it on Blockscout.

The MCP server handles transaction construction, submission, and verification. Record the deployed address.

### Route B: plain script (no MCP, no Foundry)

```bash
# Real testnet USDC as the stake token:
STAKE_TOKEN=0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d \
DEPLOYER_PRIVATE_KEY=0x... AGENT_ADDRESS=0x... \
node scripts/deploy.mjs

# Or deploy MockUSDC too (self-serve mintable stakes, fastest demo):
DEPLOYER_PRIVATE_KEY=0x... AGENT_ADDRESS=0x... node scripts/deploy.mjs
```

The script prints the lines to paste into `agent/.env` and `web/.env`.

Note on the stake token: x402 oracle payments always use real testnet USDC (EIP-3009 is required for x402 and MockUSDC does not implement it). The pool stake token is independent; use real USDC for the cleanest story, MockUSDC if faucet liquidity is tight.

## 3. Oracle

```bash
cd oracle && npm install && npm run sync
cp .env.example .env    # set FACILITATOR_PRIVATE_KEY (any funded testnet key)
npm start
```

Confirm: `curl localhost:4021/result/wc2026-england-argentina-2026-07-15` returns HTTP 402 with a USDC quote. That 402 is the money shot for the demo video.

## 4. Agent

```bash
cd agent && npm install
cp .env.example .env    # POOL_ADDRESS, AGENT_PRIVATE_KEY, ORACLE_URL
npm start
```

The agent logs each x402 payment and each settlement with tx hashes.

## 5. Frontend

```bash
cd web && npm install
cp .env.example .env    # VITE_POOL_ADDRESS, VITE_TOKEN_ADDRESS
npm run dev             # or npm run build + deploy dist/ to Netlify
```

## 6. Demo flow (matches submission/demo-script.md)

```bash
# open a pool for the final that locks in 2 minutes, and stake one entry
JOIN_OUTCOME=0 POOL_ADDRESS=0x... TOKEN_ADDRESS=0x... DEPLOYER_PRIVATE_KEY=0x... \
node scripts/seed.mjs "wc2026-final-2026-07-19" "Final: MetLife Stadium" \
  "Home win,Draw after 90,Away win" 2 $(( $(date +%s) + 120 ))
```

Add the final's result to `oracle/data/results.json` when it exists (or use an already-finished match like the semifinal for the recording), wait for lock, and watch the agent pay, settle, and the frontend's referee feed light up.
