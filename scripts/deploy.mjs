/**
 * Deploy Terrace to Injective EVM with plain Node, no Foundry required.
 *
 *   node scripts/deploy.mjs                      deploy MockUSDC + TerracePool (testnet demo)
 *   STAKE_TOKEN=0x... node scripts/deploy.mjs    use an existing token (e.g. real USDC)
 *
 * Env:
 *   DEPLOYER_PRIVATE_KEY  required, funded with testnet INJ for gas
 *   AGENT_ADDRESS         required, the settlement agent's address
 *   INJECTIVE_NETWORK     testnet (default) | mainnet
 *   RPC_URL               optional override
 *
 * Prints the addresses to paste into agent/.env and web/.env.
 */
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const NETWORKS = {
  testnet: {
    id: 1439,
    name: "Injective EVM Testnet",
    rpc: "https://k8s.testnet.json-rpc.injective.network",
    explorer: "https://testnet.blockscout.injective.network",
  },
  mainnet: {
    id: 1776,
    name: "Injective EVM",
    rpc: "https://sentry.evm-rpc.injective.network",
    explorer: "https://blockscout.injective.network",
  },
};

const net = NETWORKS[process.env.INJECTIVE_NETWORK || "testnet"];
const chain = {
  id: net.id,
  name: net.name,
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || net.rpc] } },
};

const pk = process.env.DEPLOYER_PRIVATE_KEY;
const agent = process.env.AGENT_ADDRESS;
if (!pk || !agent) {
  console.error("Set DEPLOYER_PRIVATE_KEY and AGENT_ADDRESS. See DEPLOY.md.");
  process.exit(1);
}

const account = privateKeyToAccount(pk);
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ account, chain, transport: http() });

const artifact = (name) =>
  JSON.parse(readFileSync(join(root, "contracts", "out", `${name}.json`), "utf8"));

async function deploy(name, args = []) {
  const { abi, bytecode } = artifact(name);
  const hash = await walletClient.deployContract({ abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`${name}  ${receipt.contractAddress}`);
  console.log(`  tx ${net.explorer}/tx/${hash}`);
  return receipt.contractAddress;
}

console.log(`Deploying to ${net.name} (chain ${net.id}) as ${account.address}\n`);

let token = process.env.STAKE_TOKEN;
if (!token) {
  token = await deploy("MockUSDC");
} else {
  console.log(`Stake token (existing)  ${token}`);
}

const pool = await deploy("TerracePool", [token, agent]);

console.log(`
Done. Paste into your env files:

  agent/.env
    POOL_ADDRESS=${pool}

  web/.env
    VITE_POOL_ADDRESS=${pool}
    VITE_TOKEN_ADDRESS=${token}
`);
