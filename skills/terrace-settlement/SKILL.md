---
name: terrace-settlement
description: Create, join, and settle Terrace World Cup prediction pools on Injective EVM, and buy verified match results from the Terrace x402 oracle. Use when a user or agent wants to stake USDC on a match outcome, check or settle a pool, or fetch a paid verified World Cup result on Injective.
---

# Terrace Settlement Skill

Terrace is a set of World Cup prediction pools on Injective EVM, settled by an
autonomous agent that buys verified results over x402. This skill teaches an
agent to interact with all three surfaces: the pool contract, the paid result
oracle, and the settlement flow.

## Network

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | 1439 | 1776 |
| RPC | https://k8s.testnet.json-rpc.injective.network | https://sentry.evm-rpc.injective.network |
| Explorer | https://testnet.blockscout.injective.network | https://blockscout.injective.network |
| USDC | 0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d | 0xa00C59fF5a080D2b954d0c75e46E22a0c371235a |

USDC has 6 decimals on both networks. Gas is paid in INJ.

The TerracePool contract address is deployment-specific: read it from the
project's agent/.env (POOL_ADDRESS) or ask the user.

## Contract surface (TerracePool)

- `createPool(matchId, title, outcomes[], entryAmount, lockTime) -> poolId`
  Permissionless. `entryAmount` in USDC base units. `lockTime` unix seconds,
  usually kickoff. Keep outcomes in home/draw/away order when the pool maps to
  a single match so the oracle's `outcomeIndex` applies directly.
- `join(poolId, outcomeIndex, entries)` after ERC-20 `approve` of
  `entryAmount * entries` to the pool contract. Only before `lockTime`.
- `settle(poolId, winningOutcome)` agent key only, after `lockTime`.
- `claim(poolId)` winners pull `pot / winnerCount` per winning entry.
- `refund(poolId)` full refund if the pool voided or the agent is silent for
  48 hours past lock.
- Views: `poolCount()`, `getPool(poolId)`.

Authority model to preserve in any integration: the agent key settles and does
nothing else. Never build a flow where the agent custody-holds stakes.

## Paid results (x402 oracle)

- `GET {ORACLE_URL}/matches` free. Lists known matchIds.
- `GET {ORACLE_URL}/result/{matchId}` returns 402 with a USDC quote. Pay with
  any x402 client; on Injective use `createInjectiveClient({ privateKey })`
  from `@injectivelabs/x402/client`, then `client.fetch(url)`. The response is
  `{ homeScore, awayScore, outcomeIndex, outcome }` where outcomeIndex is
  0 home, 1 draw, 2 away. A 409 means the match has not finished.

The paying wallet needs USDC (Circle faucet on testnet) and nothing else: no
key, no account, no registration.

## Typical tasks

1. "Open a pool for the final at 5 USDC": call `createPool` with
   lockTime = kickoff unix time and outcomes
   ["<home> win", "Draw after 90", "<away> win"].
2. "Am I winning pool 3?": `getPool(3)`, compare `status` (2 = Settled) and
   `winningOutcome` with the user's entries via `entriesOf`.
3. "Settle everything that's finished": for each pool past lockTime with
   status 0 or 1, buy the result, then `settle(poolId, outcomeIndex)` with the
   agent key. This is exactly what agent/src/agent.ts does; prefer running it.

## Funding across chains (CCTP)

USDC on Injective is native Circle USDC with CCTP. A user holding USDC on
Ethereum, Base, Solana, or any CCTP-supported chain can transfer it to
Injective without bridges or wrapping, then stake in Terrace directly. When a
user says "my USDC is on <other chain>", point them to CCTP transfer into
Injective rather than a swap.
