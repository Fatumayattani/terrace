#!/usr/bin/env bash
# Full local end-to-end rehearsal: local chain -> deploy -> pool -> stake ->
# agent buys result -> settles -> claim. No testnet funds needed.
# Run from repo root: bash scripts/rehearse.sh
set -e
./node_modules/.bin/ganache --chain.chainId 1439 \
  --wallet.accounts "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d45c96e461e,0x3635C9ADC5DEA00000" \
  --wallet.accounts "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d,0x3635C9ADC5DEA00000" \
  >/tmp/terrace-ganache.log 2>&1 &
GANACHE_PID=$!
(cd oracle && X402_MODE=off PORT=4021 node src/server.js >/tmp/terrace-oracle.log 2>&1 &)
trap 'kill $GANACHE_PID 2>/dev/null; pkill -f "oracle/src" 2>/dev/null || true' EXIT
sleep 3
node scripts/rehearsal.mjs setup
sleep 5
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"evm_mine","params":[],"id":1}' http://127.0.0.1:8545 >/dev/null
POOL=$(node -e "console.log(require('/tmp/rehearsal.json').pool)")
(cd agent && ONESHOT=true ORACLE_FREE=true ORACLE_URL=http://localhost:4021 \
  RPC_URL=http://127.0.0.1:8545 POOL_ADDRESS=$POOL \
  AGENT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
  ./node_modules/.bin/tsx src/agent.ts)
node scripts/rehearsal.mjs verify
