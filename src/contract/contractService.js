import { ethers } from "ethers";

// 从配置文件和 ABI 文件中导入所需信息
import { USER_VAULT_ADDRESS, GOMOKU_ADDRESS } from "./contractConfig";
import UserVaultSystemABI from "./UserVaultSystemABI.json";
import GomokuABI from "./GomokuABI.json";

// 定义全局变量以缓存合约实例和 provider/signer
let provider;
let signer;
let userVaultContract;
let gomokuContract;

/**
 * 初始化 Ethers.js，连接到用户的钱包，并创建合约实例。
 * 这个函数应该在应用加载时或用户点击“连接钱包”时被调用。
 * @returns {Promise<{provider: ethers.BrowserProvider, signer: ethers.JsonRpcSigner, userVaultContract: ethers.Contract, gomokuContract: ethers.Contract}>}
 */
export const initEthers = async () => {
  // 检查 MetaMask 是否已安装
  if (!window.ethereum) {
    alert("Please install MetaMask!");
    throw new Error("No Ethereum provider found. Please install MetaMask.");
  }

  try {
    // 1. 创建一个新的 Web3 Provider
    // 使用 ethers.BrowserProvider 替代已废弃的 Web3Provider
    provider = new ethers.BrowserProvider(window.ethereum);
    
    // 2. 请求用户授权连接他们的 MetaMask 账户
    await provider.send("eth_requestAccounts", []);
    
    // 3. 获取 Signer，Signer 是一个可以发送交易（需要签名）的以太坊账户
    signer = await provider.getSigner();
    
    // 4. 使用地址、ABI 和 signer 创建两个合约的实例
    userVaultContract = new ethers.Contract(USER_VAULT_ADDRESS, UserVaultSystemABI, signer);
    gomokuContract = new ethers.Contract(GOMOKU_ADDRESS, GomokuABI, signer);
    
    console.log("Ethers.js initialized successfully.");
    console.log("Signer Address:", await signer.getAddress());
    
    // 5. 返回所有初始化好的对象，供应用的其他部分使用
    return { provider, signer, userVaultContract, gomokuContract };

  } catch (error) {
    console.error("Failed to initialize Ethers.js:", error);
    // 可以在这里向用户显示更友好的错误信息
    alert(`Error connecting to wallet: ${error.message}`);
    throw error;
  }
};

/**
 * 导出一个函数，用于在应用的其他地方获取已初始化的合约实例。
 * 这样可以避免重复初始化。
 * @returns {{userVaultContract: ethers.Contract, gomokuContract: ethers.Contract, signer: ethers.JsonRpcSigner, provider: ethers.BrowserProvider}}
 */
export const getContracts = () => {
  if (!userVaultContract || !gomokuContract) {
    throw new Error("Ethers.js has not been initialized. Please call initEthers() first.");
  }
  return { userVaultContract, gomokuContract, signer, provider };
};
