# Terrace contracts

USDT on Arbitrum Sepolia. Our deployment, mainnet-identical interface: standard ERC20, 6 decimals, name Tether USD, symbol USDT. One addition for testing: an open faucet that dispenses 1,000 USDT per call so anyone can fund themselves.

forge-std is vendored in `lib/`, so this folder is self-contained. The only tool you need is Foundry.

## Setup

Install Foundry if you do not have it:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Configure your environment:

```bash
cp .env.example .env
# edit .env with your deployer private key
```

Use a dedicated deployer account funded with about 0.01 ETH on Arbitrum Sepolia. Do not use your main wallet key.

## Build

```bash
forge build
```

## Deploy to Arbitrum Sepolia

```bash
source .env
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$ARBITRUM_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast
```

Copy the deployed address from the output into `.env` as `USDT_ADDRESS` and into `wallet/config.js` in the app.

## Fund a wallet

Faucet to yourself (the calling account receives 1,000 USDT):

```bash
source .env
cast send "$USDT_ADDRESS" "faucet()" \
  --rpc-url "$ARBITRUM_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

Faucet to any address, useful for funding Terrace-generated wallets:

```bash
cast send "$USDT_ADDRESS" "faucetTo(address)" 0xRecipientAddressHere \
  --rpc-url "$ARBITRUM_SEPOLIA_RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

Check a balance:

```bash
cast call "$USDT_ADDRESS" "balanceOf(address)(uint256)" 0xAddressHere \
  --rpc-url "$ARBITRUM_SEPOLIA_RPC_URL"
```

Balances print in raw units. 1 USDT equals 1000000 because the token uses 6 decimals.

## Notes

The deployer receives 1,000,000 USDT at deployment for funding test wallets in bulk. Everything in this token is real on-chain state on Arbitrum Sepolia. Migrating Terrace to mainnet USDt is a config change: swap `USDT_ADDRESS` and the RPC URL.
