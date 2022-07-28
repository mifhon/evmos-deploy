## 背景
在开发的过程中，验证p2p，共识算法等模块一般需要搭建4节点。官方提供了[Multi Node](https://docs.evmos.org/developers/localnet/multi_node.html)以及[Testnet command](https://docs.evmos.org/developers/localnet/testnet_cmd.html)这两种方式搭建多节点的方式。但是这两种方式有如下缺点：Multi Node 实际是使用docker搭建的，对开发不太友好。而 Testnet command 的方式创建好4节点的配置之后，很多的端口是使用的是同一个端口导致无法启动。而且该方式是在同一个进程里面启动得，无法模拟开发模式。

基于上面的需求以及现状，在官方提供的 Testnet command 模式的基础上，使用JavaScript脚本实现一个命令就能启动多节点。无论搭建多少个节点(以我搭建32个为例，太多节点机器性能不够无法运转了)，让你能在不到30秒内完成上面所有的操作。

## 使用步骤
* 安装Node.js，安装v16.x版本。
* 在项目目录执行npm i安装依赖。
* 将你编译好的evmosd放到项目目录。
* config.default.json为蓝本，将内容复制一份到新建的文件config.json里面。按照你的需求你更新一下配置。
* 执行 node init.js --start true。
  * nohup 启动脚本是在后台用 nohup 启动，默认 true
  * platform 当前平台(darwin,linux,win32)，默认空，不传通过process.platform获取
  * start 初始化之后是否立即启动所有节点，默认 false
  * validators 共识节点的个数，默认为 4 个
  * compile 是否需要强制重新编译代码。注意：此模式需要该项目放到evmos项目代码目录。
* 执行 npm run start 启动所有节点。
* 执行 npm run stop 停止所有节点。

## 一些小提示
* 如果目录下面不存在evmosd可执行文件，会主动尝试进行编译。
* 生成的nodes目录下面的脚本文件，你可以根据需要进行改动或者启动部分。
* 因为使用命令 evmosd testnet init-files 生成的配置文件的端口都是同样的，在同一台机器显然这样是无法启动多节点的。所以我会自动更新配置文件的端口。比如rpc Server Port 为 26657，那么第一个节点为 26657，第二个为 26658，所有节点依次递增。但是由于有些端口是相邻的，比如 grpcPort 为 9090，而 grpcWebPort 为 9091，如果都递增显然还是有冲突，此时我会某个端口递增，某个端口递减。端口递增还是递减如下所示：
  * swaggerPort +递增
  * rosettaPort +递增
  * grpcPort -递减
  * grpcWebPort +递增
  * jsonRpcPort -递减
  * wsRpcPort +递增
  * rpcServerPort +递增
  * p2pPort +递增
  * pprofPort +递增
* 如果需要在初始化执行编译代码，最好是将项目放到evmos项目代码目录之后重命名为build目录，evmos项目的Git已经忽略了build目录的改动。



