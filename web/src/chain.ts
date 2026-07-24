// Chain access layer: viem public reads, wallet writes, event feed.
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  defineChain,
  type Address,
  type WalletClient,
} from "viem";
import { CONFIG } from "./config";
import { TERRACE_POOL_ABI } from "./abi";

export const chain = defineChain({
  id: CONFIG.network.chainId,
  name: CONFIG.network.name,
  nativeCurrency: CONFIG.network.currency,
  rpcUrls: { default: { http: [CONFIG.network.rpcUrl] } },
  blockExplorers: { default: { name: "Blockscout", url: CONFIG.network.explorer } },
});

export const publicClient = createPublicClient({ chain, transport: http() });

export type PoolStatus = 0 | 1 | 2 | 3; // Open, Locked, Settled, Voided

export interface PoolView {
  id: bigint;
  matchId: string;
  title: string;
  outcomes: string[];
  entryAmount: bigint;
  lockTime: bigint;
  winningOutcome: number;
  status: PoolStatus;
  pot: bigint;
  outcomeEntries: bigint[];
}

export async function fetchPools(): Promise<PoolView[]> {
  if (!CONFIG.poolAddress) return [];
  const count = (await publicClient.readContract({
    address: CONFIG.poolAddress,
    abi: TERRACE_POOL_ABI,
    functionName: "poolCount",
  })) as bigint;

  const pools: PoolView[] = [];
  for (let id = 0n; id < count; id++) {
    const [matchId, title, outcomes, entryAmount, lockTime, winningOutcome, status, pot, outcomeEntries] =
      (await publicClient.readContract({
        address: CONFIG.poolAddress,
        abi: TERRACE_POOL_ABI,
        functionName: "getPool",
        args: [id],
      })) as [string, string, string[], bigint, bigint, number, number, bigint, bigint[]];
    pools.push({
      id,
      matchId,
      title,
      outcomes: [...outcomes],
      entryAmount,
      lockTime,
      winningOutcome,
      status: status as PoolStatus,
      pot,
      outcomeEntries: [...outcomeEntries],
    });
  }
  return pools.reverse(); // newest first
}

export interface FeedEvent {
  kind: "Settled" | "Voided" | "Claimed" | "Joined" | "PoolCreated";
  poolId: bigint;
  detail: string;
  txHash: string;
}

export async function fetchFeed(): Promise<FeedEvent[]> {
  if (!CONFIG.poolAddress) return [];
  const latest = await publicClient.getBlockNumber();
  const from = latest > 50_000n ? latest - 50_000n : 0n;
  const logs = await publicClient.getContractEvents({
    address: CONFIG.poolAddress,
    abi: TERRACE_POOL_ABI,
    fromBlock: from,
    toBlock: latest,
  });

  const events: FeedEvent[] = [];
  for (const log of logs) {
    const a = log.args as Record<string, unknown>;
    switch (log.eventName) {
      case "Settled":
        events.push({
          kind: "Settled",
          poolId: a.poolId as bigint,
          detail: `outcome ${a.winningOutcome} wins, pot ${a.pot}, ${a.winnerCount} winners`,
          txHash: log.transactionHash!,
        });
        break;
      case "Voided":
        events.push({
          kind: "Voided",
          poolId: a.poolId as bigint,
          detail: `no entries on outcome ${a.declaredOutcome}, all stakes refundable`,
          txHash: log.transactionHash!,
        });
        break;
      case "Claimed":
        events.push({
          kind: "Claimed",
          poolId: a.poolId as bigint,
          detail: `winner claimed ${a.amount}`,
          txHash: log.transactionHash!,
        });
        break;
      case "Joined":
        events.push({
          kind: "Joined",
          poolId: a.poolId as bigint,
          detail: `entry on outcome ${a.outcome}`,
          txHash: log.transactionHash!,
        });
        break;
      case "PoolCreated":
        events.push({
          kind: "PoolCreated",
          poolId: a.poolId as bigint,
          detail: `${a.title}`,
          txHash: log.transactionHash!,
        });
        break;
    }
  }
  return events.reverse();
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
type EthereumProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function provider(): EthereumProvider | null {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null;
}

export async function connectWallet(): Promise<{ address: Address; wallet: WalletClient } | null> {
  const eth = provider();
  if (!eth) return null;

  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CONFIG.network.chainIdHex }],
    });
  } catch {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CONFIG.network.chainIdHex,
          chainName: CONFIG.network.name,
          rpcUrls: [CONFIG.network.rpcUrl],
          nativeCurrency: CONFIG.network.currency,
          blockExplorerUrls: [CONFIG.network.explorer],
        },
      ],
    });
  }

  const wallet = createWalletClient({ chain, transport: custom(eth) });
  return { address: accounts[0], wallet };
}

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export async function joinPool(
  wallet: WalletClient,
  address: Address,
  poolId: bigint,
  outcome: number,
  entries: bigint,
  entryAmount: bigint
): Promise<string> {
  if (!CONFIG.poolAddress || !CONFIG.tokenAddress) throw new Error("contract not configured");
  const amount = entryAmount * entries;

  const allowance = (await publicClient.readContract({
    address: CONFIG.tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address, CONFIG.poolAddress],
  })) as bigint;

  if (allowance < amount) {
    const approveHash = await wallet.writeContract({
      chain,
      account: address,
      address: CONFIG.tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONFIG.poolAddress, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const hash = await wallet.writeContract({
    chain,
    account: address,
    address: CONFIG.poolAddress,
    abi: TERRACE_POOL_ABI,
    functionName: "join",
    args: [poolId, outcome, entries],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function claimPool(wallet: WalletClient, address: Address, poolId: bigint): Promise<string> {
  if (!CONFIG.poolAddress) throw new Error("contract not configured");
  const hash = await wallet.writeContract({
    chain,
    account: address,
    address: CONFIG.poolAddress,
    abi: TERRACE_POOL_ABI,
    functionName: "claim",
    args: [poolId],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function createPool(
  wallet: WalletClient,
  address: Address,
  matchId: string,
  title: string,
  outcomes: string[],
  entryAmount: bigint,
  lockTime: bigint
): Promise<string> {
  if (!CONFIG.poolAddress) throw new Error("contract not configured");
  const hash = await wallet.writeContract({
    chain,
    account: address,
    address: CONFIG.poolAddress,
    abi: TERRACE_POOL_ABI,
    functionName: "createPool",
    args: [matchId, title, outcomes, entryAmount, lockTime],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
