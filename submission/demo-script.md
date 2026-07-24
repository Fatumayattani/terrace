# Demo video script (target: 90 seconds)

Record after deploying to testnet. Use an already-finished real match (the July 15 semifinal, England 1-2 Argentina) so settlement is guaranteed on camera. Screen record with voiceover; OBS or Loom.

## Setup before recording

1. Contracts deployed, oracle running with X402_MODE=local, agent NOT yet started.
2. Seed a pool for the semifinal with lockTime already passed:
   ```bash
   JOIN_OUTCOME=2 POOL_ADDRESS=0x... TOKEN_ADDRESS=0x... DEPLOYER_PRIVATE_KEY=0x... \
   node scripts/seed.mjs "wc2026-england-argentina-2026-07-15" \
     "Semi-final: England v Argentina" "England win,Draw after 90,Argentina win" 2 <past-unix-time>
   ```
   Note: createPool requires future lockTime, so seed it with lock 60s ahead, stake immediately, wait out the 60s while recording the frontend.
3. Frontend open in one window, terminal split: oracle logs left, agent command ready right.

## Script

**[0:00-0:12] Frontend, pool grid.**
"This is Terrace. World Cup prediction pools in USDC on Injective. My crew staked on the semifinal. England or Argentina. The pot is locked in the contract, and no human holds the money or calls the result."

**[0:12-0:25] Terminal: curl the oracle unpaid.**
```bash
curl -i localhost:4021/result/wc2026-england-argentina-2026-07-15
```
"Results come from an oracle that charges per call. No API key, no account. HTTP 402: Payment Required, five cents in USDC on Injective EVM."

**[0:25-0:45] Start the agent. Let the logs roll.**
"Now the referee clocks in. The agent finds the locked pool, hits the oracle, gets the 402, signs a USDC payment with x402, and buys the verified result. England 1, Argentina 2. There's the payment receipt, on-chain."

**[0:45-1:00] Agent settles; switch to frontend as feed updates.**
"With the result verified, the agent settles on-chain. Full time. The referee feed picks up the contract event, and the winning outcome is stamped on the ticket."

**[1:00-1:15] Click Claim winnings in the wallet flow.**
"Winners pull their share straight from the contract. The agent could never have taken this money. Its only power is calling the score, and if it ever goes silent, everyone refunds in full after 48 hours."

**[1:15-1:30] README architecture diagram, quick scroll.**
"x402 on both sides of the wire, CCTP USDC as the only asset, deployed through the Injective MCP server, and an Agent Skill so other agents can run pools of their own. Terrace: the stand settles itself."

## Capture list for X post screenshots

- The 402 curl output (crop to show amount + eip155:1439 + asset address)
- Agent log: "paid for result via x402" + settle tx line
- Frontend settled ticket with FULL TIME stamp
- Blockscout: TerracePool contract page with settle tx
