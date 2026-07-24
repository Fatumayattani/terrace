// Demo pools shown when no contract is configured (VITE_POOL_ADDRESS unset).
// Uses real 2026 knockout fixtures so screenshots reflect the live tournament.
import type { FeedEvent, PoolView } from "./chain";

const now = BigInt(Math.floor(Date.now() / 1000));

export const DEMO_POOLS: PoolView[] = [
  {
    id: 3n,
    matchId: "wc2026-final-2026-07-19",
    title: "Final · MetLife Stadium",
    outcomes: ["Argentina win", "Draw after 90", "Opponent win"],
    entryAmount: 5_000_000n, // 5 USDC
    lockTime: now + 60n * 60n * 30n,
    winningOutcome: 0,
    status: 0,
    pot: 145_000_000n,
    outcomeEntries: [17n, 4n, 8n],
  },
  {
    id: 2n,
    matchId: "wc2026-third-place-2026-07-18",
    title: "Third place play-off",
    outcomes: ["England win", "Draw after 90", "Opponent win"],
    entryAmount: 2_000_000n,
    lockTime: now + 60n * 60n * 7n,
    winningOutcome: 0,
    status: 0,
    pot: 42_000_000n,
    outcomeEntries: [9n, 5n, 7n],
  },
  {
    id: 1n,
    matchId: "wc2026-england-argentina-2026-07-15",
    title: "Semi-final: England v Argentina",
    outcomes: ["England win", "Draw after 90", "Argentina win"],
    entryAmount: 3_000_000n,
    lockTime: now - 60n * 60n * 40n,
    winningOutcome: 2,
    status: 2,
    pot: 96_000_000n,
    outcomeEntries: [12n, 6n, 14n],
  },
  {
    id: 0n,
    matchId: "wc2026-france-spain-2026-07-14",
    title: "Semi-final: France v Spain",
    outcomes: ["France win", "Draw after 90", "Spain win"],
    entryAmount: 3_000_000n,
    lockTime: now - 60n * 60n * 64n,
    winningOutcome: 0,
    status: 2,
    pot: 81_000_000n,
    outcomeEntries: [11n, 3n, 13n],
  },
];

export const DEMO_FEED: FeedEvent[] = [
  {
    kind: "Settled",
    poolId: 1n,
    detail: "England 1-2 Argentina. Outcome 2 wins, 14 winners split 96.00 USDC",
    txHash: "0xdemo",
  },
  {
    kind: "Claimed",
    poolId: 1n,
    detail: "winner claimed 6.85 USDC",
    txHash: "0xdemo",
  },
  {
    kind: "Settled",
    poolId: 0n,
    detail: "France won semi-final 1. Outcome 0 wins, 11 winners split 81.00 USDC",
    txHash: "0xdemo",
  },
  {
    kind: "PoolCreated",
    poolId: 3n,
    detail: "Final · MetLife Stadium",
    txHash: "0xdemo",
  },
];
