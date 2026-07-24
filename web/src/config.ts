// Terrace frontend configuration.
// Set these in web/.env (Vite reads VITE_* vars) after deploying:
//   VITE_POOL_ADDRESS=0x...      TerracePool on Injective EVM
//   VITE_TOKEN_ADDRESS=0x...     stake token (USDC or MockUSDC)
//   VITE_NETWORK=testnet|mainnet
// With no pool address set, the app runs in demo mode with sample pools so
// the interface is fully explorable before deployment.

export const NETWORKS = {
  testnet: {
    chainId: 1439,
    chainIdHex: "0x59f",
    name: "Injective EVM Testnet",
    rpcUrl: "https://k8s.testnet.json-rpc.injective.network",
    explorer: "https://testnet.blockscout.injective.network",
    currency: { name: "Injective", symbol: "INJ", decimals: 18 },
  },
  mainnet: {
    chainId: 1776,
    chainIdHex: "0x6f0",
    name: "Injective EVM",
    rpcUrl: "https://sentry.evm-rpc.injective.network",
    explorer: "https://blockscout.injective.network",
    currency: { name: "Injective", symbol: "INJ", decimals: 18 },
  },
} as const;

export type NetworkKey = keyof typeof NETWORKS;

const networkKey = (import.meta.env.VITE_NETWORK as NetworkKey) || "testnet";

export const CONFIG = {
  network: NETWORKS[networkKey],
  poolAddress: (import.meta.env.VITE_POOL_ADDRESS as `0x${string}` | undefined) ?? null,
  tokenAddress: (import.meta.env.VITE_TOKEN_ADDRESS as `0x${string}` | undefined) ?? null,
  demoMode: !import.meta.env.VITE_POOL_ADDRESS,
};

export const TOKEN_DECIMALS = 6;

export function formatUSDC(baseUnits: bigint): string {
  const whole = baseUnits / 1_000_000n;
  const frac = (baseUnits % 1_000_000n) / 10_000n; // 2 dp
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}
