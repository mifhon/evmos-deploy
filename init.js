import { createRequire } from "module";
const require = createRequire(import.meta.url);
const yargs = require("yargs");

let argv = yargs
  .option("n", {
    alias: "nohup",
    demandOption: false,
    default: true,
    describe: "Whether the startup script is nohup",
    type: "bool",
  })
  .option("c", {
    alias: "compile",
    demandOption: false,
    default: false,
    describe: "Whether compile code",
    type: "bool",
  })
  .option("v", {
    alias: "validators",
    demandOption: false,
    default: 4,
    describe: "Number of validators to initialize the testnet with (default 4)",
    type: "number",
  })
  .option("cn", {
    alias: "commonNode",
    demandOption: false,
    default: 0,
    describe: "Number of common node to initialize the testnet with (default 0)",
    type: "number",
  })
  .option("p", {
    alias: "platform",
    demandOption: false,
    default: "",
    describe: "platform(darwin,linux,win32)",
    type: "string",
  })
  .option("s", {
    alias: "start",
    demandOption: false,
    default: false,
    describe: "Whether after initialize immediate start",
    type: "bool",
  })
  .number(["v"])
  .number(["cn"])
  .boolean(["n", "c", "s"]).argv;

const isNohup = argv.nohup;
const isStart = argv.start;
const isCompile = argv.compile;
const commonNode = argv.commonNode;
const validators = argv.validators;
const nodesCount = validators + commonNode;

const platform = argv.platform ? argv.platform : process.platform;
console.log(JSON.stringify(argv));

const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs-extra");
const path = require("path");
import TenderKeys from "./tenderKeys.js";
const curDir = process.cwd();
const nodesDir = path.join(curDir, "nodes");
const evmosd = platform == "win32" ? "evmosd.exe" : "evmosd";
const scriptStop = path.join(nodesDir, platform == "win32" ? "stopAll.vbs" : "stopAll.sh");
const scriptStart = path.join(nodesDir, platform == "win32" ? "startAll.vbs" : "startAll.sh");
const tenderKeys = new TenderKeys();
const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};

let init = async function () {
  try {
    // ??????????????????
    let config;
    try {
      config = await fs.readJson("./config.json");
    } catch (error) {
      config = await fs.readJson("./config.default.json");
    }

    if (await fs.pathExists(scriptStop)) {
      console.log("Try to stop the evmosd under the nodes directory");
      await exec(scriptStop, { cwd: nodesDir }); // Anyway, stop it first
      await sleep(300);
    }
    if (!fs.existsSync(evmosd) || isCompile) {
      console.log("Start recompiling evmosd...");
      let make = await exec("go build ../cmd/evmosd", { cwd: curDir });
      console.log("evmosd compile finished", make);
    }

    if (!fs.existsSync(evmosd)) {
      console.log("evmosd Executable file does not exist");
      return;
    }

    if (validators < 1) {
      console.log("validators >= 1");
      return;
    }

    console.log("Start cleaning up folder nodes");
    await fs.emptyDir(nodesDir);
    await fs.ensureDir(nodesDir);
    console.log("Folder nodes has been cleaned up");
    {
      const initFiles = `${platform !== "win32" ? "./" : ""}${evmosd} testnet init-files --v ${nodesCount} --output-dir ./nodes --keyring-backend test`;
      const initFilesValidator = `${platform !== "win32" ? "./" : ""}${evmosd} testnet init-files --v ${validators} --output-dir ./nodes --keyring-backend test`;
      console.log(`Exec cmd: ${initFiles}`);
      const { stdout, stderr } = await exec(initFiles, { cwd: curDir });
      console.log(`init-files ${stdout}${stderr}\n`);

      if (commonNode > 0) {
        for (let i = 0; i < validators; i++) {
          await fs.remove(path.join(nodesDir, `node${i}`));
        }
        await fs.remove(path.join(nodesDir, `gentxs`));

        // re init validator, and turn a validator node into a common node
        await exec(initFilesValidator, { cwd: curDir });
        const genesisPath = path.join(nodesDir, `node0/evmosd/config/genesis.json`);
        for (let i = validators; i < nodesCount; i++) {
          await fs.copy(genesisPath, path.join(nodesDir, `node${i}/evmosd/config/genesis.json`));
        }
      }
    }

    await fs.copy(evmosd, `./nodes/${evmosd}`);

    let nodeIds = [];
    for (let i = 0; i < nodesCount; i++) {
      const nodeKey = await fs.readJSON(path.join(nodesDir, `node${i}/evmosd/config/node_key.json`));
      const nodeId = tenderKeys.getBurrowAddressFromPrivKey(Buffer.from(nodeKey.priv_key.value, "base64").toString("hex"));
      nodeIds.push(nodeId);
    }

    for (let i = 0; i < nodesCount; i++) {
      let data;
      const appConfigPath = path.join(nodesDir, `node${i}/evmosd/config/app.toml`);
      const swaggerPort = config.swaggerPort || 1317;
      const rosettaPort = config.rosettaPort || 8080;
      const grpcPort = config.grpcPort || 9090;
      const grpcWebPort = config.grpcWebPort || 9091;
      const jsonRpcPort = config.jsonRpcPort || 8545;
      const wsRpcPort = config.wsRpcPort || 8546;
      data = await fs.readFile(appConfigPath, "utf8");
      data = data.replace("tcp://0.0.0.0:1317", `tcp://0.0.0.0:${swaggerPort + i}`);
      data = data.replace("swagger = false", `swagger = true`);
      data = data.replaceAll("enabled-unsafe-cors = false", `enabled-unsafe-cors = true`);
      // data = data.replaceAll("enable = false", `enable = true`) // on rosetta enable is false, and we need is false
      data = data.replace(":8080", `:${rosettaPort + i}`);
      data = data.replace("0.0.0.0:9090", `0.0.0.0:${grpcPort - i}`);
      data = data.replace("0.0.0.0:9091", `0.0.0.0:${grpcWebPort + i}`);
      data = data.replace("0.0.0.0:8545", `0.0.0.0:${jsonRpcPort - i}`);
      data = data.replace("0.0.0.0:8546", `0.0.0.0:${wsRpcPort + i}`);
      data = data.replace("eth,net,web3", `eth,txpool,personal,net,debug,web3`);
      await fs.writeFile(appConfigPath, data);

      const configPath = path.join(nodesDir, `node${i}/evmosd/config/config.toml`);
      const rpcServerPort = config.rpcServerPort || 26657;
      const p2pPort = config.p2pPort || 10000;
      const pprofPort = config.pprofPort || 6060;
      data = await fs.readFile(configPath, "utf8");
      data = data.replace("0.0.0.0:26657", `0.0.0.0:${rpcServerPort + i}`);
      data = data.replaceAll("cors_allowed_origins = []", `cors_allowed_origins = ["*"]`);
      data = data.replaceAll("allow_duplicate_ip = false", `allow_duplicate_ip = true`);
      data = data.replace("tcp://0.0.0.0:26656", `tcp://0.0.0.0:${p2pPort + i}`);
      data = data.replace("localhost:6060", `localhost:${pprofPort + i}`);
      data = data.replace("40f4fac63da8b1ce8f850b0fa0f79b2699d2ce72@seed.evmos.jerrychong.com:26656,e3e11fca4ecf4035a751f3fea90e3a821e274487@bd-evmos-mainnet-seed-node-01.bdnodes.net:26656,fc86e7e75c5d2e4699535e1b1bec98ae55b16826@bd-evmos-mainnet-seed-node-02.bdnodes.net:26656", ``);

      // replace persistent_peers
      let peers = [];
      const str = `persistent_peers = "`;
      const indexStart = data.indexOf(str);
      const indexEnd = data.indexOf(`"`, indexStart + str.length);
      let oldPeers = data.substring(indexStart + str.length, indexEnd);
      for (let j = 0; j < nodesCount && nodesCount > 1; j++) {
        if (i != j) {
          peers.push(`${nodeIds[j]}@127.0.0.1:${p2pPort + j}`);
        }
      }
      if (oldPeers.length > 0) {
        data = data.replace(oldPeers, peers.join());
      } else {
        data = data.replace(`persistent_peers = ""`, `persistent_peers = "${peers.join()}"`); // if validator == 1 && common node >= 1
      }
      await fs.writeFile(configPath, data);
    }

    // ????????????????????????
    let vbsStart = platform == "win32" ? `set ws=WScript.CreateObject("WScript.Shell")\n` : `#!/bin/bash\n`;
    let vbsStop = platform == "win32" ? `set ws=WScript.CreateObject("WScript.Shell")\n` : `#!/bin/bash\n`;
    for (let i = 0; i < nodesCount; i++) {
      let p2pPort = config.p2pPort + i;
      let start = (platform == "win32" ? "" : "#!/bin/bash\n") + (isNohup && platform !== "win32" ? "nohup " : "") + (platform !== "win32" ? "./" : "") + `${evmosd} start --home ./node${i}/evmosd/` + (isNohup && platform !== "win32" ? ` >./evmos${i}.log 2>&1 &` : "");
      let stop =
        platform == "win32"
          ? `@echo off
for /f "tokens=5" %%i in ('netstat -ano ^| findstr 0.0.0.0:${p2pPort}') do set PID=%%i
taskkill /F /PID %PID%`
          : platform == "linux"
          ? `pid=\`netstat -anp | grep :::${p2pPort} | awk '{printf $7}' | cut -d/ -f1\`;
    kill -15 $pid`
          : `pid=\`lsof -i :${p2pPort} | grep evmosd | grep LISTEN | awk '{printf $2}'|cut -d/ -f1\`;
    if [ "$pid" != "" ]; then kill -15 $pid; fi`;
      let startPath = path.join(nodesDir, `start${i}.` + (platform == "win32" ? "bat" : "sh"));
      let stopPath = path.join(nodesDir, `stop${i}.` + (platform == "win32" ? "bat" : "sh"));
      await fs.writeFile(startPath, start);
      await fs.writeFile(stopPath, stop);

      if (platform == "win32") {
        vbsStart += `ws.Run ".\\start${i}.bat",0\n`;
        vbsStop += `ws.Run ".\\stop${i}.bat",0\n`;
      } else {
        vbsStart += `./start${i}.sh\n`;
        vbsStop += `./stop${i}.sh\n`;
        await fs.chmod(startPath, 0o777);
        await fs.chmod(stopPath, 0o777);
      }
    }
    // ????????????????????????
    let startAllPath = path.join(nodesDir, `startAll.` + (platform == "win32" ? "vbs" : "sh"));
    let stopAllPath = path.join(nodesDir, `stopAll.` + (platform == "win32" ? "vbs" : "sh"));
    await fs.writeFile(startAllPath, vbsStart);
    await fs.writeFile(stopAllPath, vbsStop);
    if (!(platform == "win32")) {
      await fs.chmod(startAllPath, 0o777);
      await fs.chmod(stopAllPath, 0o777);
    }

    if (isStart) {
      console.log("Start all evmosd node under the folder nodes");
      await exec(scriptStart, { cwd: nodesDir }); // ?????????????????????????????????
    }
  } catch (error) {
    console.log("error", error);
  }
};

init();
