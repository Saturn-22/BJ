# Web3 五子棋 DApp 后端

本项目包含了去中心化五子棋 (Gomoku) DApp 的后端智能合约，使用 Hardhat 作为开发环境，构建于以太坊区块链之上。

该系统允许玩家创建和加入游戏，使用加密货币作为赌注进行对战，并在游戏结束后由合约自动将总奖池判给赢家。

<br>

## 目录
- [项目架构](#项目架构)
- [环境设置](#环境设置)
  - [环境要求](#环境要求)
  - [安装依赖](#安装依赖)
  - [项目配置](#项目配置)
- [使用指南](#使用指南)
  - [编译合约](#编译合约)
  - [运行测试](#运行测试)
  - [部署合约](#部署合约)
- [许可证](#许可证)

<br>

---

## 项目架构

后端由两个核心智能合约组成：

- **`UserVaultSystem.sol`**: 负责管理用户账户、资金余额、注册登录以及账户冻结等安全功能。它作为用户资金的安全金库。
- **`Gomoku.sol`**: 包含所有游戏逻辑，如创建/加入游戏、管理棋盘状态、处理玩家落子以及胜负判断。它通过与 `UserVaultSystem` 交互来处理赌注，但自身不长期持有用户资金。

<br>

## 环境设置

### 环境要求

- [Node.js](https://nodejs.org/en/) (>=18.0.0)
- [NPM](https://www.npmjs.com/)

### 安装依赖

1.  克隆代码仓库:
    ```sh
    git clone <YOUR_REPOSITORY_URL>
    cd Web3Gomoku
    ```
2.  安装依赖:
    ```sh
    npm install
    ```

### 项目配置

在项目根目录创建一个 `.env` 文件，并添加以下环境变量。该文件用于存放敏感信息，不应提交到版本控制中。

```
SEPOLIA_RPC_URL="你的 Alchemy 或 Infura RPC URL"
PRIVATE_KEY="你的钱包私钥（不带 0x 前缀）"
ETHERSCAN_API_KEY="你的 Etherscan API Key"
```

<br>

## 使用指南

### 编译合约

编译所有智能合约：

```sh
npx hardhat compile
```

### 运行测试

运行合约的单元测试：

```sh
npx hardhat test
```

### 部署合约

部署流程分为两步，且必须按顺序执行。

**第一步: 部署 `UserVaultSystem`**

运行金库合约的部署脚本。

```sh
npx hardhat run scripts/deployUserVault.js --network sepolia
```

从终端输出中复制新部署的合约地址。

**第二步: 部署 `Gomoku`**

1.  打开 `scripts/deploy.js` 文件。
2.  将刚刚复制的 `UserVaultSystem` 合约地址粘贴到 `USER_VAULT_ADDRESS` 变量中。
3.  运行 Gomoku 游戏合约的部署脚本。

```sh
npx hardhat run scripts/deploy.js --network sepolia
```

**第三步: 将 `Gomoku` 合约加入白名单**

在两个合约都部署成功后，您必须调用 `UserVaultSystem` 合约的 `addToWhitelist` 函数，并将 `Gomoku` 合约的地址作为参数传入。此操作授予游戏合约管理赌注的权限。您可以通过 Etherscan 网站的 "Write Contract" 功能来完成此操作。

<br>

## 许可证

本项目采用 MIT 许可证。
