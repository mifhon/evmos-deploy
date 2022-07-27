import TenderKeys from './tenderKeys.js'
const tenderKeys = new TenderKeys();

// 根据助记词生成公私钥
let world = "aware casino smile syrup analyst sketch rich there noise horror canoe toddler pink churn bid cloud airport because input nation donate guilt script common"
const seed = tenderKeys.generateSeed(world)
console.log(tenderKeys.generateKeyPair(seed))

// 根据私钥生成公钥以及地址
const validatorPrivateKey = {
  "address": "910BF59BA4B0F97C485A56A0735CA64140F1C7F9",
  "pub_key": {
    "type": "tendermint/PubKeyEd25519",
    "value": "4EGW5emKoPh5wRakqxGeSEuWpZIpWqFdnOxp6erABeI=" // 解码之后为：e04196e5e98aa0f879c116a4ab119e484b96a592295aa15d9cec69e9eac005e2
  },
  "priv_key": {
    "type": "tendermint/PrivKeyEd25519",
    "value": "zUlVh3T+EjCxfD3hur1gtgB0ShBGOAWIj76Dc/fmggXgQZbl6Yqg+HnBFqSrEZ5IS5alkilaoV2c7Gnp6sAF4g=="
  }
}
const privateKey = Buffer.from(validatorPrivateKey.priv_key.value, "base64").toString("hex")
const address = tenderKeys.getBurrowAddressFromPrivKey(privateKey)
const publicKey = tenderKeys.getPubKeyFromPrivKey(privateKey)
console.log("address", address)
console.log("publicKey", publicKey)

// {
//   publicKey: 'abc0553f079d16b8e6eee843060c16be1bc6604ac5957f3fcf9d241af826dc54',
//   privateKey: '5db417aa9c9b45d402801921e4b7c85295ff795f337a5507eaf31ac924545668abc0553f079d16b8e6eee843060c16be1bc6604ac5957f3fcf9d241af826dc54'
// }
// address 910bf59ba4b0f97c485a56a0735ca64140f1c7f9
// publicKey e04196e5e98aa0f879c116a4ab119e484b96a592295aa15d9cec69e9eac005e2