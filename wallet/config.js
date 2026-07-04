// Terrace wallet configuration
// Single source of truth for chain, RPC, and token settings.
// Migrating to mainnet is a change to this file only.

export const CHAIN = {
  name: 'Arbitrum Sepolia',
  chainId: 421614,
  rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
  explorerTxUrl: 'https://sepolia.arbiscan.io/tx/'
}

export const USDT = {
  address: '0x4acC21dA01e865D9Aaeb0254E3f20a9F10784619',
  symbol: 'USDT',
  decimals: 6
}

// Convert a human amount like 1.5 to token units (bigint)
export function toUnits (amount) {
  const [whole, frac = ''] = String(amount).split('.')
  const fracPadded = (frac + '000000').slice(0, USDT.decimals)
  return BigInt(whole || '0') * 10n ** BigInt(USDT.decimals) + BigInt(fracPadded)
}

// Convert token units (bigint) to a human string like "1.50"
export function fromUnits (units) {
  const value = BigInt(units)
  const base = 10n ** BigInt(USDT.decimals)
  const whole = value / base
  const frac = (value % base).toString().padStart(USDT.decimals, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole.toString()
}
