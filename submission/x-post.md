# X post for submission

Required: tag @injective @NinjaLabsHQ @NinjaLabsCN, hashtag #InjectiveGlobalCupHackathon, name all four technologies, attach demo video or screenshots. Post from your account, then paste the post URL into the Typeform.

---

## Main post

Every World Cup pool has the same weak point: someone holds the money, someone calls the result.

Terrace fixes both. 🏟️

Fans stake USDC in prediction pools on @injective. At full time, an autonomous referee agent BUYS the verified score over x402 for $0.05, then settles the pool on-chain. Winners claim. The agent can call the score but can never touch the money.

Built with all four of Injective's new stack pieces doing real work:

⚡ x402: the agent is a paying customer. 402 quote → signed USDC auth → verified result, settled in one ~650ms block. Machine pays machine, no API keys.

💵 USDC CCTP: stakes, payouts, and oracle payments are all native Circle USDC. Your USDC on any of 20+ chains moves in without bridges.

🤖 MCP Server: contracts deployed through the Injective MCP workflow in Claude Code, prompt to verified deployment.

📚 Agent Skills: ships a terrace-settlement SKILL.md so any agent can open pools, stake, and settle.

Demo + code 👇
#InjectiveGlobalCupHackathon @NinjaLabsHQ @NinjaLabsCN

[attach demo video]
github.com/Fatumayattani/terrace

---

## Comment thread (one screenshot each, +1 point per live-data screenshot)

1. Screenshot: curl of the 402 response with the USDC quote on eip155:1439.
   "This is the moment I love: the oracle says 402 Payment Required, quotes $0.05 USDC on Injective EVM, and the agent just... pays it. No signup. No key."

2. Screenshot: agent logs showing x402 payment receipt tx + settle tx.
   "Referee's matchday: buy result (x402 receipt on-chain), settle pool, full time. Every call auditable on Blockscout."

3. Screenshot: frontend ticket for the settled semifinal (England 1-2 Argentina, real 2026 data).
   "Real tournament data. The oracle synced all 102 finished matches of WC2026, and pools settle against verified scores."

4. Screenshot: TerracePool on Blockscout.
   "Bounded authority: the agent key can settle and nothing else. Funds only move via winner claim or staker refund. 48h agent silence = everyone refunds in full."
