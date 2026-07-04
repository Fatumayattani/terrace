// Terrace wallet smoke test
// Proves the money layer end to end: create or load a wallet, print the
// address, show the USDT balance, and optionally send a tip.
//
// Usage:
//   node scripts/wallet-smoke.js
//   node scripts/wallet-smoke.js <recipientAddress> <amount>
//
// First run prints a fresh address. Fund it with the faucet:
//   cast send $USDT_ADDRESS "faucetTo(address)" <printedAddress> \
//     --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --private-key $PRIVATE_KEY
// Then run again with a recipient and amount to send a real transfer.

import { TerraceWallet } from '../wallet/wdk.js'
import { getUsdtBalance, quoteTip, sendTip } from '../wallet/usdt.js'

const PASSPHRASE = 'terrace-dev'
const STORAGE = './.terrace-dev-wallet'

async function main () {
  const [recipient, amount] = process.argv.slice(2)

  const wallet = new TerraceWallet(STORAGE, PASSPHRASE)
  const { address, isNew } = await wallet.init()

  console.log(isNew ? 'Created new wallet' : 'Loaded existing wallet')
  console.log('Address:', address)

  const balance = await getUsdtBalance(wallet.account)
  console.log('USDT balance:', balance)

  if (recipient && amount) {
    const fee = await quoteTip(wallet.account, recipient, amount)
    console.log('Quoted network fee (wei):', fee.toString())

    console.log(`Sending ${amount} USDT to ${recipient}...`)
    const receipt = await sendTip(wallet.account, recipient, amount)
    console.log('Sent. Receipt:')
    console.log(JSON.stringify(receipt, null, 2))
  } else {
    console.log('\nTo test a transfer: node scripts/wallet-smoke.js <recipient> <amount>')
  }

  wallet.dispose()
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
