// Local end-to-end rehearsal against ganache (chainId 1439 on :8545).
// Phase "setup": deploy MockUSDC + TerracePool, mint, create pool (lock +4s), join outcome 2.
// Phase "verify": confirm the agent settled the pool, then claim and check balance.
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";

const PK_FAN = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d45c96e461e";
const PK_AGENT = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const chain = {
  id: 1439,
  name: "local",
  nativeCurrency: { name: "INJ", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
};

const fan = privateKeyToAccount(PK_FAN);
const agentAcct = privateKeyToAccount(PK_AGENT);
const pub = createPublicClient({ chain, transport: http() });
const wal = createWalletClient({ account: fan, chain, transport: http() });

const art = (n) => JSON.parse(readFileSync(`contracts/out/${n}.json`, "utf8"));
const MATCH = "wc2026-england-argentina-2026-07-15";

const phase = process.argv[2];

if (phase === "setup") {
  console.log(`fan=${fan.address} agent=${agentAcct.address}`);

  let hash = await wal.deployContract({ ...art("MockUSDC") });
  const usdc = (await pub.waitForTransactionReceipt({ hash })).contractAddress;
  hash = await wal.deployContract({ ...art("TerracePool"), args: [usdc, agentAcct.address] });
  const pool = (await pub.waitForTransactionReceipt({ hash })).contractAddress;
  console.log(`MockUSDC=${usdc} TerracePool=${pool}`);

  const usdcAbi = art("MockUSDC").abi;
  const poolAbi = art("TerracePool").abi;

  hash = await wal.writeContract({ address: usdc, abi: usdcAbi, functionName: "mint", args: [fan.address, 100_000_000n] });
  await pub.waitForTransactionReceipt({ hash });
  hash = await wal.writeContract({ address: usdc, abi: usdcAbi, functionName: "approve", args: [pool, 100_000_000n] });
  await pub.waitForTransactionReceipt({ hash });

  const lock = BigInt(Math.floor(Date.now() / 1000) + 4);
  hash = await wal.writeContract({
    address: pool, abi: poolAbi, functionName: "createPool",
    args: [MATCH, "Semi-final: England v Argentina", ["England win", "Draw after 90", "Argentina win"], 3_000_000n, lock],
  });
  await pub.waitForTransactionReceipt({ hash });
  hash = await wal.writeContract({ address: pool, abi: poolAbi, functionName: "join", args: [0n, 2, 2n] });
  await pub.waitForTransactionReceipt({ hash });
  console.log("pool #0 created, 2 entries staked on outcome 2 (Argentina win), locks in 4s");

  writeFileSync("/tmp/rehearsal.json", JSON.stringify({ usdc, pool }));
} else if (phase === "verify") {
  const { usdc, pool } = JSON.parse(readFileSync("/tmp/rehearsal.json", "utf8"));
  const poolAbi = art("TerracePool").abi;
  const usdcAbi = art("MockUSDC").abi;

  const p = await pub.readContract({ address: pool, abi: poolAbi, functionName: "getPool", args: [0n] });
  const status = p[6];
  const winning = p[5];
  console.log(`pool status=${status} (2=Settled) winningOutcome=${winning} pot=${p[7]}`);
  if (status !== 2) { console.error("FAIL: agent did not settle"); process.exit(1); }
  if (winning !== 2) { console.error("FAIL: wrong outcome, expected 2 (Argentina)"); process.exit(1); }

  const before = await pub.readContract({ address: usdc, abi: usdcAbi, functionName: "balanceOf", args: [fan.address] });
  const hash = await wal.writeContract({ address: pool, abi: poolAbi, functionName: "claim", args: [0n] });
  await pub.waitForTransactionReceipt({ hash });
  const after = await pub.readContract({ address: usdc, abi: usdcAbi, functionName: "balanceOf", args: [fan.address] });
  console.log(`claim: balance ${before} -> ${after} (won back full 6.00 pot as sole winner)`);
  if (after - before !== 6_000_000n) { console.error("FAIL: unexpected payout"); process.exit(1); }
  console.log("REHEARSAL PASSED: create -> join -> agent x402 fetch -> settle -> claim");
}
