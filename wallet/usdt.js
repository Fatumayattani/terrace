// Terrace USDT operations on Arbitrum Sepolia
// Every function takes the account from TerraceWallet. Amounts cross this
// boundary as human strings ("1.5") and leave as bigint token units.

import { USDT, CHAIN, toUnits, fromUnits } from './config.js'

// Returns the USDT balance as a human string, e.g. "12.5"
export async function getUsdtBalance (account) {
  const balances = await account.getTokenBalances([USDT.address])
  // Normalize: module may return a map keyed by address or an array
  const raw = Array.isArray(balances)
    ? balances[0]?.balance ?? balances[0]
    : balances[USDT.address] ?? balances[USDT.address.toLowerCase()]
  return fromUnits(raw ?? 0n)
}

// Quote the network fee for a transfer without sending, fee in wei
export async function quoteTip (account, recipient, humanAmount) {
  const quote = await account.quoteTransfer({
    token: USDT.address,
    recipient,
    amount: toUnits(humanAmount)
  })
  return quote.fee
}

// Send USDT. Returns a settle receipt ready to publish into the room ledger.
export async function sendTip (account, recipient, humanAmount) {
  const result = await account.transfer({
    token: USDT.address,
    recipient,
    amount: toUnits(humanAmount)
  })
  return {
    txHash: result.hash,
    explorerUrl: CHAIN.explorerTxUrl + result.hash,
    recipient,
    amount: humanAmount,
    token: USDT.symbol,
    chainId: CHAIN.chainId,
    sentAt: Date.now()
  }
}
