/**
 * Open a pool from the CLI, and optionally stake one entry on an outcome.
 *
 *   node scripts/seed.mjs "wc2026-final-2026-07-19" "Final: MetLife Stadium" "Team A win,Draw after 90,Team B win" 5 <lockUnixSeconds>
 *   JOIN_OUTCOME=0 node scripts/seed.mjs ...   also stakes 1 entry on outcome 0
 *
 * Env: DEPLOYER_PRIVATE_KEY, POOL_ADDRESS, TOKEN_ADDRESS, INJECTIVE_NETWORK, RPC_URL
 * If the token is MockUSDC, the script mints itself enough to join.
 */
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [matchId, title, outcomesCsv, entryUsdc, lockArg] = process.argv.slice(2);
if (!matchId || !title || !outcomesCsv || !entryUsdc) {
  console.error('usage: node scripts/seed.mjs <matchId> <title> "<a,b,c>" <entryUSDC> [lockUnix]');
  process.exit(1);
}

const NET = {
  testnet: { id: 1439, rpc: "https://k8s.testnet.json-rpc.injective.network" },
  mainnet: { id: 1776, rpc: "https://sentry.evm-rpc.injective.network" },
}[process.env.INJECTIVE_NETWORK || "testnet"];

const chain = {
  id: NET.id,
  name: "Injective EVM",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || NET.rpc] } },
};

const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const pub = createPublicClient({ chain, transport: http() });
const wal = createWalletClient({ account, chain, transport: http() });

const poolAbi = JSON.parse(readFileSync(join(root, "contracts", "out", "TerracePool.json"), "utf8")).abi;
const POOL = process.env.POOL_ADDRESS;
const TOKEN = process.env.TOKEN_ADDRESS;

const outcomes = outcomesCsv.split(",").map((s) => s.trim());
const entryAmount = BigInt(Math.round(parseFloat(entryUsdc) * 1_000_000));
const lockTime = BigInt(lockArg || Math.floor(Date.now() / 1000) + 3600);

let hash = await wal.writeContract({
  address: POOL, abi: poolAbi, functionName: "createPool",
  args: [matchId, title, outcomes, entryAmount, lockTime],
});
await pub.waitForTransactionReceipt({ hash });
const poolId = (await pub.readContract({ address: POOL, abi: poolAbi, functionName: "poolCount" })) - 1n;
console.log(`pool #${poolId} created  tx=${hash}`);

if (process.env.JOIN_OUTCOME !== undefined) {
  const erc20 = parseAbi([
    "function mint(address to, uint256 amount)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ]);
  const bal = await pub.readContract({ address: TOKEN, abi: erc20, functionName: "balanceOf", args: [account.address] });
  if (bal < entryAmount) {
    try {
      hash = await wal.writeContract({ address: TOKEN, abi: erc20, functionName: "mint", args: [account.address, 1_000_000_000n] });
      await pub.waitForTransactionReceipt({ hash });
      console.log("minted 1000 mUSDC");
    } catch {
      console.error("balance too low and token is not mintable; fund the wallet with USDC first");
      process.exit(1);
    }
  }
  hash = await wal.writeContract({ address: TOKEN, abi: erc20, functionName: "approve", args: [POOL, entryAmount] });
  await pub.waitForTransactionReceipt({ hash });
  hash = await wal.writeContract({
    address: POOL, abi: poolAbi, functionName: "join",
    args: [poolId, Number(process.env.JOIN_OUTCOME), 1n],
  });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`staked 1 entry on outcome ${process.env.JOIN_OUTCOME}  tx=${hash}`);
}
