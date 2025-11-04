import { ethers } from "ethers";
import { BLACKJACK_ADDRESS, USER_VAULT_ADDRESS } from "./contractConfig";
import BlackjackABI from "./BlackjackABI.json";
import UserVaultSystemABI from "./UserVaultSystemABI.json";

// Blackjack 专用的合约实例缓存
let blackjackContract;
let userVaultContract;
let provider;
let signer;

/**
 * 初始化 Blackjack 游戏所需的合约
 * @returns {Promise<{blackjackContract: ethers.Contract, userVaultContract: ethers.Contract, signer: ethers.JsonRpcSigner}>}
 */
export const initBlackjackContracts = async () => {
  if (!window.ethereum) {
    throw new Error("Please install MetaMask!");
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    
    // 初始化 Blackjack 结算合约
    blackjackContract = new ethers.Contract(BLACKJACK_ADDRESS, BlackjackABI, signer);
    
    // 初始化 UserVault 合约（用于余额管理）
    userVaultContract = new ethers.Contract(USER_VAULT_ADDRESS, UserVaultSystemABI, signer);
    
    console.log("Blackjack contracts initialized successfully.");
    console.log("Blackjack Contract Address:", BLACKJACK_ADDRESS);
    
    return { blackjackContract, userVaultContract, signer };
  } catch (error) {
    console.error("Failed to initialize Blackjack contracts:", error);
    throw error;
  }
};

/**
 * 获取 Blackjack 合约实例
 */
export const getBlackjackContract = () => {
  if (!blackjackContract) {
    throw new Error("Blackjack contract not initialized. Call initBlackjackContracts() first.");
  }
  return blackjackContract;
};

/**
 * 获取 UserVault 合约实例（Blackjack 专用）
 */
export const getUserVaultContract = () => {
  if (!userVaultContract) {
    throw new Error("UserVault contract not initialized. Call initBlackjackContracts() first.");
  }
  return userVaultContract;
};

/**
 * 获取当前 Signer
 */
export const getSigner = () => {
  if (!signer) {
    throw new Error("Signer not initialized. Call initBlackjackContracts() first.");
  }
  return signer;
};


