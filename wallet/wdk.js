// Terrace wallet lifecycle
// The only module that ever touches the seed phrase.
// Seed is stored encrypted on disk with AES-256-GCM, key derived via scrypt.

import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { CHAIN } from './config.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1 }
const KEY_LENGTH = 32

function deriveKey (passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KEY_LENGTH, SCRYPT_PARAMS)
}

function encryptSeed (seedPhrase, passphrase) {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = deriveKey(passphrase, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(seedPhrase, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    v: 1,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex')
  })
}

function decryptSeed (blob, passphrase) {
  const { salt, iv, tag, data } = JSON.parse(blob)
  const key = deriveKey(passphrase, Buffer.from(salt, 'hex'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final()
  ]).toString('utf8')
}

export class TerraceWallet {
  constructor (storageDir, passphrase) {
    this.seedPath = path.join(storageDir, 'seed.enc')
    this.passphrase = passphrase
    this.manager = null
    this.account = null
    this.address = null
    fs.mkdirSync(storageDir, { recursive: true })
  }

  hasSeed () {
    return fs.existsSync(this.seedPath)
  }

  // Creates a new seed if none exists, otherwise loads the existing one.
  // Returns { address, isNew }
  async init () {
    let seedPhrase
    let isNew = false

    if (this.hasSeed()) {
      seedPhrase = decryptSeed(fs.readFileSync(this.seedPath, 'utf8'), this.passphrase)
    } else {
      seedPhrase = WalletManagerEvm.getRandomSeedPhrase()
      fs.writeFileSync(this.seedPath, encryptSeed(seedPhrase, this.passphrase), { mode: 0o600 })
      isNew = true
    }

    this.manager = new WalletManagerEvm(seedPhrase, {
      provider: CHAIN.rpcUrl
    })
    seedPhrase = null

    this.account = await this.manager.getAccount(0)
    this.address = await this.account.getAddress()

    return { address: this.address, isNew }
  }

  // Reveal the seed for backup, requires the passphrase again by design
  revealSeed (passphrase) {
    return decryptSeed(fs.readFileSync(this.seedPath, 'utf8'), passphrase)
  }

  dispose () {
    if (this.manager) this.manager.dispose()
    this.manager = null
    this.account = null
  }
}
