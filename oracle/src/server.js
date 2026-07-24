/**
 * Terrace Result Oracle
 *
 * A pay-per-call World Cup result endpoint gated by x402 on Injective EVM.
 * Humans and AI agents pay a few cents in USDC per verified result, with no
 * API key and no account. The Terrace settlement agent is its first customer.
 *
 * Routes:
 *   GET /health            free   liveness probe
 *   GET /matches           free   known matches and their status
 *   GET /result/:matchId   PAID   verified final result (x402, USDC)
 *
 * Modes (X402_MODE):
 *   local   (default) the oracle runs its own facilitator with
 *           FACILITATOR_PRIVATE_KEY, settling payments on Injective EVM
 *   remote  use a hosted facilitator via X402_FACILITATOR_URL
 *   off     no paywall, for local development only
 */
import express from "express";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { injectivePaymentMiddleware } from "@injectivelabs/x402/middleware";
import { INJECTIVE_MAINNET_CAIP2, INJECTIVE_TESTNET_CAIP2, TOKENS } from "@injectivelabs/x402/networks";

const root = dirname(fileURLToPath(import.meta.url));
const app = express();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 4021);
const MODE = process.env.X402_MODE || "local";
const NETWORK =
  process.env.INJECTIVE_NETWORK === "mainnet" ? INJECTIVE_MAINNET_CAIP2 : INJECTIVE_TESTNET_CAIP2;
const USDC = TOKENS[NETWORK].USDC; // address + decimals from the official lib
const PRICE = process.env.RESULT_PRICE_BASE_UNITS || "50000"; // $0.05 in 6-decimal USDC

// ---------------------------------------------------------------------------
// Result store: results.json is authoritative. `npm run sync` refreshes it
// from the openfootball public-domain 2026 feed.
// ---------------------------------------------------------------------------
function loadResults() {
  return JSON.parse(readFileSync(join(root, "..", "data", "results.json"), "utf8"));
}

// ---------------------------------------------------------------------------
// x402 paywall on the result route
// ---------------------------------------------------------------------------
if (MODE !== "off") {
  const routes = {
    "GET /result/:matchId": {
      description: "Verified FIFA World Cup 2026 final result for one match",
      mimeType: "application/json",
      accepts: [
        {
          network: NETWORK,
          asset: USDC.address,
          amount: PRICE,
          ...(process.env.PAY_TO ? { payTo: process.env.PAY_TO } : {}),
        },
      ],
    },
  };

  const options =
    MODE === "remote"
      ? { facilitatorUrl: mustEnv("X402_FACILITATOR_URL") }
      : {
          facilitator: {
            privateKey: mustEnv("FACILITATOR_PRIVATE_KEY"),
            ...(process.env.RPC_URL ? { rpcUrl: process.env.RPC_URL } : {}),
          },
        };

  app.use(injectivePaymentMiddleware(routes, options));
  console.log(`[oracle] x402 paywall ON  network=${NETWORK} asset=${USDC.address} price=${PRICE}`);
} else {
  console.log("[oracle] x402 paywall OFF (X402_MODE=off, development only)");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true, service: "terrace-oracle" }));

app.get("/matches", (_req, res) => {
  const results = loadResults();
  res.json({
    count: Object.keys(results).length,
    matches: Object.entries(results).map(([id, m]) => ({
      matchId: id,
      title: m.title,
      finished: m.finished,
    })),
  });
});

app.get("/result/:matchId", (req, res) => {
  const results = loadResults();
  const m = results[req.params.matchId];
  if (!m) return res.status(404).json({ error: "unknown matchId", known: Object.keys(results) });
  if (!m.finished) return res.status(409).json({ error: "match not finished", matchId: req.params.matchId });
  res.json({
    matchId: req.params.matchId,
    title: m.title,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    // Outcome index convention shared with TerracePool pools that use
    // [home win, draw, away win]:
    outcomeIndex: m.homeScore > m.awayScore ? 0 : m.homeScore === m.awayScore ? 1 : 2,
    outcome: m.homeScore > m.awayScore ? "HOME" : m.homeScore === m.awayScore ? "DRAW" : "AWAY",
    source: m.source,
    verifiedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => console.log(`[oracle] listening on :${PORT}`));

function mustEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[oracle] missing required env ${name}`);
    process.exit(1);
  }
  return v;
}
