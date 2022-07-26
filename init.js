import { createRequire } from "module";
const require = createRequire(import.meta.url);
const yargs = require('yargs');

let argv = yargs
  .option('n', {
    alias: 'nohup',
    demandOption: false,
    default: true,
    describe: '启动脚本是否是nohup',
    type: 'bool'
  })
  .option('v', {
    alias: 'validators',
    demandOption: false,
    default: 4,
    describe: 'Number of validators to initialize the testnet with (default 4)',
    type: 'number'
  })
  .option('c', {
    alias: 'console',
    demandOption: false,
    default: false,
    describe: '启动脚本是否是console',
    type: 'bool'
  })
  .option('p', {
    alias: 'platform',
    demandOption: false,
    default: "",
    describe: '当前平台(darwin,linux,win32)',
    type: 'string'
  })
  .option('s', {
    alias: 'start',
    demandOption: false,
    default: false,
    describe: '是否初始化立即启动',
    type: 'bool'
  })
  .number(['v'])
  .boolean(['n', 'c', 's'])
  .argv;

const isNohup = argv.nohup;
const isConsole = argv.console;
const isStart = argv.start;
const validators = argv.validators

const platform = argv.platform ? argv.platform : process.platform
console.log(argv, platform);

const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs-extra");
const path = require("path");
const Web3 = require("web3");
const web3 = new Web3();
const curDir = process.cwd();
const nodesDir = path.join(curDir, "nodes");
const evmosd = platform == "win32" ? "evmosd.exe" : "evmosd";
const scriptStop = path.join(nodesDir, platform == "win32" ? "stopAll.vbs" : "stopAll.sh");
const scriptStart = path.join(nodesDir, platform == "win32" ? "startAll.vbs" : "startAll.sh");
const sleep = (time) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};

let init = async function () {
  try {
    // 读取配置文件
    let config = await fs.readJson("./config.json");
    let startRpcPort = config.startRpcPort;
    let startP2pPort = config.startP2pPort;
    let cmd = config.cmd;

    console.log("开始清理文件夹nodes");
    if (await fs.pathExists(scriptStop)) {
      // console.log("尝试停止nodes目录下面的geth节点");
      // await exec(scriptStop, { cwd: dir }) // 不管怎样先执行一下停止
      // await sleep(300);
    }
    if (!fs.existsSync(evmosd)) {
      console.log("开始重新编译evmosd...");
      // let make = await exec("go run build/ci.go install ./cmd/geth", { cwd: path.join(cwd, "..", "..") }); // 重新编译
      // console.log("evmosd编译完毕", make);
    }

    await fs.emptyDir(nodesDir);
    await fs.ensureDir(nodesDir);
    console.log("文件夹nodes已清理完毕");
    {
      const initFiles = `${evmosd} testnet init-files --v ${validators} --output-dir ./nodes`
      console.log(`exec cmd: ${initFiles}`)
      const { stdout, stderr } = await exec(initFiles, { cwd: curDir });
      console.log(`init-files ${stdout}${stderr}\n`);
    }

    await fs.copy(evmosd, `./nodes/${evmosd}`);
    for (let i = 0; i < validators; i++) {
      let data;
      const appConfigPath = path.join(nodesDir, `node${i}/evmosd/config/app.toml`)
      const swaggerPort = 1317
      const rosettaPort = 8080
      const grpcPort = 9090
      const grpcWebPort = 9091
      const jsonRpcPort = 8545
      const wsRpcPort = 8546
      data = await fs.readFile(appConfigPath, "utf8")
      data = data.replace("tcp://0.0.0.0:1317", `tcp://0.0.0.0:${swaggerPort + i}`)
      data = data.replace("swagger = false", `swagger = true`)
      data = data.replace("enabled-unsafe-cors = false", `enabled-unsafe-cors = true`)
      data = data.replace("enable = false", `enable = true`)
      data = data.replace(":8080", `:${rosettaPort + i}`)
      data = data.replace("0.0.0.0:9090", `0.0.0.0:${grpcPort - i}`)
      data = data.replace("0.0.0.0:9091", `0.0.0.0:${grpcWebPort + i}`)
      data = data.replace("0.0.0.0:8545", `0.0.0.0:${jsonRpcPort - i}`)
      data = data.replace("0.0.0.0:8546", `0.0.0.0:${wsRpcPort + i}`)
      data = data.replace("eth,net,web3", `eth,txpool,personal,net,debug,web3`)
      await fs.writeFile(appConfigPath, data)

      const configPath = path.join(nodesDir, `node${i}/evmosd/config/config.toml`)
      const rpcServerPort = 16657
      const p2pPort = 10106
      const pprofPort = 6060
      data = await fs.readFile(configPath, "utf8")
      data = data.replace("0.0.0.0:26657", `0.0.0.0:${rpcServerPort + i}`)
      data = data.replace("cors_allowed_origins = []", `cors_allowed_origins = ["*"]`)
      data = data.replace("tcp://0.0.0.0:26656", `tcp://0.0.0.0:${p2pPort + i}`)
      data = data.replace("localhost:6060", `localhost:${pprofPort + i}`)
      data = data.replace("40f4fac63da8b1ce8f850b0fa0f79b2699d2ce72@seed.evmos.jerrychong.com:26656,e3e11fca4ecf4035a751f3fea90e3a821e274487@bd-evmos-mainnet-seed-node-01.bdnodes.net:26656,fc86e7e75c5d2e4699535e1b1bec98ae55b16826@bd-evmos-mainnet-seed-node-02.bdnodes.net:26656", ``)
      for (let j = 1; j <= validators; j++) {
        const peer = `192.168.0.${j}:26656`
        data = data.replace(peer, `127.0.0.1:${p2pPort + j - 1}`)
      }
      await fs.writeFile(configPath, data)
    }

    /*
        // 生成启动命令脚本
        let vbsStart = platform == "win32" ? `set ws=WScript.CreateObject("WScript.Shell")\n` : `#!/bin/bash\n`;
        let vbsStop = platform == "win32" ? `set ws=WScript.CreateObject("WScript.Shell")\n` : `#!/bin/bash\n`;
        for (let i = 1; i <= nodesCount; i++) {
          let httpPort = startRpcPort + i - 1;
          let p2pPort = startP2pPort + i - 1;
          let start1 = (platform == "win32" ? "" : "#!/bin/bash\n" + (isNohup ? "nohup " : "") + "./") + `${evmosd} --datadir ./node${i} --unlock ${keystores[i - 1].address} --miner.etherbase ${keystores[i - 1].address} --password ./pwd ${cmd} --ws.port ${httpPort} --http.port ${httpPort} --port ${p2pPort} ${i <= config.authorityNode || isMine ? `--mine --miner.threads 1` : ""}` + (isConsole ? " console" : "") + (isNohup ? ` >./node${i}/geth.log 2>&1 &` : "");
          let start2 = (platform == "win32" ? "" : "#!/bin/bash\n./") + `${evmosd} --datadir ./node${i} --unlock ${keystores[i - 1].address} --miner.etherbase ${keystores[i - 1].address} --password ./pwd ${cmd} --ws.port ${httpPort} --http.port ${httpPort} --port ${p2pPort} ${i <= config.authorityNode || isMine ? `--mine --miner.threads 1` : ""}` + (isConsole ? " console" : "");
          let stop = platform == "win32"
            ? `@echo off
    for /f "tokens=5" %%i in ('netstat -ano ^ | findstr 0.0.0.0:${httpPort}') do set PID=%%i
    taskkill /F /PID %PID%`
            : platform == "linux" ? `pid=\`netstat -anp | grep :::${httpPort} | awk '{printf $7}' | cut -d/ -f1\`;
    kill -15 $pid` :
              `pid=\`lsof -i :${httpPort} | grep geth | grep LISTEN | awk '{printf $2}'|cut -d/ -f1\`;
    if [ "$pid" != "" ]; then kill -15 $pid; fi`;
          let startPath = path.join(nodesDir, `start${i}.` + (platform == "win32" ? "bat" : "sh"));
          let stopPath = path.join(nodesDir, `stop${i}.` + (platform == "win32" ? "bat" : "sh"));
          await fs.writeFile(startPath, platform == "win32" ? start2 : start1);
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
        // 生成总的启动脚本
        let startAllPath = path.join(nodesDir, `startAll.` + (platform == "win32" ? "vbs" : "sh"));
        let stopAllPath = path.join(nodesDir, `stopAll.` + (platform == "win32" ? "vbs" : "sh"));
        await fs.writeFile(startAllPath, vbsStart);
        await fs.writeFile(stopAllPath, vbsStop);
        if (!(platform == "win32")) {
          await fs.chmod(startAllPath, 0o777);
          await fs.chmod(stopAllPath, 0o777);
        }
    
        if (isStart) {
          console.log("启动文件夹nodes下面所有节点");
          await exec(scriptStart, { cwd: nodesDir }) // 不管怎样先执行一下停止
        }
    */
  } catch (error) {
    console.log("error", error);
  }
};

init();
