import crypto from "crypto"
import bip39 from "bip39"
import ed25519 from "ed25519"
import RIPEMD160 from "ripemd160"

const TYPE_ED25519 = '01';
const PUBKEY_PREFIX = '0120';//0x01   0x20 = 32 

const PUBKEY_LENGTH = 64; // 32 bytes
const SEED_LENGTH = 64; // 32 bytes
const PRIVKEY_LENGTH = 128; // 64 bytes
const ADDRESS_LENGTH = 40; //20 bytes

const PUBKEY_NAME = 'PublicKey';
const SEED_NAME = 'Seed';
const PRIVKEY_NAME = 'PrivateKey';
const ADDRESS_NAME = 'Address';

export default class TenderKeys {
  generateKeyPair(seed) {
    this._isHexString(seed, SEED_NAME, SEED_LENGTH);
    let buffer = Buffer.from(seed, "hex")
    let keyPair = ed25519.MakeKeypair(buffer);
    return {
      publicKey: keyPair.publicKey.toString('hex').toLowerCase(),
      privateKey: keyPair.privateKey.toString("hex").toLowerCase()
    };
  }

  generateRandomMnemonic() {
    return bip39.generateMnemonic();
  }

  generateSeed(mnemonic) {
    let hash = crypto.createHash('sha256');
    hash.update(mnemonic);
    return hash.digest('hex').toLowerCase();
  }

  getTendermintAddress(publicKey) {
    this._isHexString(publicKey, PUBKEY_NAME, PUBKEY_LENGTH);
    let ripmd160 = new RIPEMD160();
    let buffer = this._hexStringToBytes(TYPE_ED25519 + PUBKEY_PREFIX + publicKey);
    return ripmd160.update(buffer).digest('hex').toLowerCase();
  }

  getBurrowAddress(publicKey) {
    let hash = crypto.createHash('sha256');
    let buffer = this._hexStringToBytes(publicKey)
    hash.update(buffer);
    return hash.digest('hex').toLowerCase().substring(0, 40);
  }

  getTendermintAddressFromPrivKey(privateKey) {
    this._isHexString(privateKey, PRIVKEY_NAME, PRIVKEY_LENGTH);
    let publicKey = privateKey.substring(64, 128);
    return this.getTendermintAddress(publicKey);
  }
  getBurrowAddressFromPrivKey(privateKey) {
    this._isHexString(privateKey, PRIVKEY_NAME, PRIVKEY_LENGTH);
    let publicKey = privateKey.substring(64, 128);
    return this.getBurrowAddress(publicKey);
  }
  getPubKeyFromPrivKey(privateKey) {
    this._isHexString(privateKey, PRIVKEY_NAME, PRIVKEY_LENGTH);
    return privateKey.substring(64, 128);
  }

  validateMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic);
  }

  validateAddress(publicKey, address) {
    this._isHexString(publicKey, PUBKEY_NAME, PUBKEY_LENGTH);
    this._isHexString(address, ADDRESS_NAME, ADDRESS_LENGTH);
    return this.generateAddress(publicKey.toLowerCase() == address.toLowerCase());
  }

  sign(privKeyStr, txStr) {
    let buffer = Buffer.from(txStr);
    let privKey = Buffer.from(privKeyStr, "hex");
    let signature = ed25519.Sign(buffer, privKey);

    return signature.toString("hex");
  }

  _isHexString(hexString, name, length) {
    if (typeof hexString != 'string') {
      throw new Error('\nError : The type of' + name + ' must be string!');
    }

    if (hexString.length != length) {
      throw new Error('\nError : The length of' + name + ' must be ' + length);
    }

    let arr = hexString.split();
    for (let i = 0; i < arr.length; i++)
      if (!arr[i].match(/[0-9A-Fa-f]/))
        throw new Error("Error : unexpected junk in  " + name);
  }

  _hexStringToBytes(hexStr) {
    let result = [];
    while (hexStr.length >= 2) {
      result.push(parseInt(hexStr.substring(0, 2), 16));
      hexStr = hexStr.substring(2, hexStr.length);
    }
    return Buffer.from(result);
  }
}