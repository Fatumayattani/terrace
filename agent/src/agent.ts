/**
 * Terrace Settlement Agent
 *
 * An autonomous referee for World Cup prediction pools on Injective EVM.
 *
 * Loop, every POLL_SECONDS:
 *   1. Read every pool from the TerracePool contract.
 *   2. For pools past lockTime and not yet settled, buy the verified result
 *      from the Terrace oracle. The oracle is x402-gated: the agent receives
 *      a 402 quote, signs a USDC EIP-3009 authorization, and retries. It pays
 *      cents per call, with an on-chain receipt, no API key, no account.
 *   3. Call settle(poolId, outcomeIndex) on-chain.
 *
 * Bounded authority: this key can only settle. It cannot withdraw, pause, or
 * redirect funds. Its worst case is a wrong outcome, and the contract's void
 * and refund paths bound even that.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { injectiveEvm, injectiveEvmTestnet } from "@injectivelabs/x402/networks";
import { createInjectiveClient } from "@injectivelabs/x402/client";
import { TERRACE_POOL_ABI } from "./abi.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const chain = process.env.INJECTIVE_NETWORK === "mainnet" ? injectiveEvm : injectiveEvmTestnet;
const RPC_URL = process.env.RPC_URL || chain.rpcUrls.default.http[0];
const POOL_ADDRESS = mustEnv("POOL_ADDRESS") as Address;
const AGENT_PRIVATE_KEY = mustEnv("AGENT_PRIVATE_KEY") as Hex;
const ORACLE_URL = process.env.ORACLE_URL || "http://localhost:4021";
const ORACLE_FREE = process.env.ORACLE_FREE === "true"; // dev only, skips x402
const POLL_SECONDS = Number(process.env.POLL_SECONDS || 20);

const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

// x402-aware fetch: pays USDC automatically when the oracle answers 402.
const payingClient = createInjectiveClient({
  privateKey: AGENT_PRIVATE_KEY,
  ...(process.env.RPC_URL ? { rpcUrl: process.env.RPC_URL } : {}),
});

const STATUS = ["Open", "Locked", "Settled", "Voided"] as const;

log(`referee on duty  chain=${chain.id} pool=${POOL_ADDRESS} oracle=${ORACLE_URL} payer=${account.address}`);

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function tick() {
  const count = (await publicClient.readContract({
    address: POOL_ADDRESS,
    abi: TERRACE_POOL_ABI,
    functionName: "poolCount",
  })) as bigint;

  const now = BigInt(Math.floor(Date.now() / 1000));

  for (let id = 0n; id < count; id++) {
    const [matchId, title, outcomes, , lockTime, , status] = (await publicClient.readContract({
      address: POOL_ADDRESS,
      abi: TERRACE_POOL_ABI,
      functionName: "getPool",
      args: [id],
    })) as [string, string, string[], bigint, bigint, number, number, bigint, bigint[]];

    const settleable = (status === 0 || status === 1) && now >= lockTime;
    if (!settleable) continue;

    log(`pool #${id} "${title}" is past lock and ${STATUS[status]}. Buying result for ${matchId}...`);

    const result = await buyResult(matchId);
    if (!result) continue;

    if (result.outcomeIndex >= outcomes.length) {
      log(`pool #${id} outcome index ${result.outcomeIndex} out of range, skipping`);
      continue;
    }

    log(
      `verified: ${result.title} finished ${result.homeScore}-${result.awayScore} (${result.outcome}). ` +
        `Settling pool #${id} on outcome [${result.outcomeIndex}] "${outcomes[result.outcomeIndex]}"`
    );

    try {
      const hash = await walletClient.writeContract({
        address: POOL_ADDRESS,
        abi: TERRACE_POOL_ABI,
        functionName: "settle",
        args: [id, result.outcomeIndex],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      log(`pool #${id} settled. tx=${hash} block=${receipt.blockNumber} FULL TIME.`);
    } catch (err) {
      log(`pool #${id} settle failed: ${(err as Error).message.split("\n")[0]}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Pay-per-result via x402
// ---------------------------------------------------------------------------
type OracleResult = {
  matchId: string;
  title: string;
  homeScore: number;
  awayScore: number;
  outcomeIndex: number;
  outcome: string;
};

async function buyResult(matchId: string): Promise<OracleResult | null> {
  const url = `${ORACLE_URL}/result/${encodeURIComponent(matchId)}`;
  try {
    const res = ORACLE_FREE ? await fetch(url) : await payingClient.fetch(url);
    if (res.status === 409) {
      log(`oracle: ${matchId} not finished yet, will retry`);
      return null;
    }
    if (!res.ok) {
      log(`oracle: ${res.status} for ${matchId}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const receipt = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("X-PAYMENT-RESPONSE");
    if (receipt) {
      const decoded = JSON.parse(Buffer.from(receipt, "base64").toString("utf8"));
      log(`paid for result via x402. settlement tx=${decoded.transaction ?? "(see facilitator)"}`);
    }
    return (await res.json()) as OracleResult;
  } catch (err) {
    log(`oracle unreachable: ${(err as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
function log(msg: string) {
  console.log(`[terrace-agent ${new Date().toISOString()}] ${msg}`);
}

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[terrace-agent] missing required env ${name}`);
    process.exit(1);
  }
  return v;
}

await tick();
if (process.env.ONESHOT === "true") {
  log("oneshot pass complete, referee off duty");
  process.exit(0);
}
setInterval(() => tick().catch((e) => log(`tick error: ${e.message}`)), POLL_SECONDS * 1000);
