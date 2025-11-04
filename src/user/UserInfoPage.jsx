import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
// 绉婚櫎鏃х殑鍚堢害瀵煎叆
// import { UserVaultABI } from "../contract/contractABI";
// import { CONTRACT_ADDRESS } from "../contract/contractConfig";
import { userInfoBg } from "../backgroundImage";

// 瀵煎叆鏂扮殑鍚堢害鏈嶅姟
import { initEthers, getContracts } from "../contract/contractService";

const UserInfoPage = ({ userInfo, onBack, onChangePassword, onLogout, onRecharge, onWithdraw }) => {
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState(userInfo);

  // 浣跨敤 useEffect 鍒锋柊鐢ㄦ埛淇℃伅
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const { userVaultContract } = await initEthers();
        const info = await userVaultContract.getUserInfo();
        setCurrentUserInfo({
          username: info.username,
          balance: info.balance.toString(),
          frozen: info.frozen,
        });
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      }
    };
    fetchUserInfo();
  }, []);


  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const { userVaultContract } = getContracts();
      const tx = await userVaultContract.logout();
      await tx.wait();
      alert("鉁?Logged out");
      onLogout?.();
    } catch (err) {
      console.error(err);
      alert("鉂?Logout failed: " + (err.reason || err.message));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={onBack}>猬?Back</button>

      <h2>User Information</h2>
      <div style={styles.infoBox}>
        <div><strong>Username:</strong> {currentUserInfo.username}</div>
        <div><strong>Balance:</strong> {ethers.formatEther(currentUserInfo.balance || "0")} ETH</div>
        <div><strong>Status:</strong> {currentUserInfo.frozen ? "鉂?Frozen" : "鉁?Active"}</div>
      </div>

      <div style={styles.buttonGroup}>
        <button style={styles.actionButton} onClick={onChangePassword}>
          Change Password
        </button>
        <button style={styles.actionButton} onClick={onRecharge}>
          Recharge
        </button>
        <button style={styles.actionButton} onClick={onWithdraw}>
          Withdraw
        </button>
        <button style={styles.actionButton} onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    textAlign: "center",
    backgroundImage: `url(${userInfoBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    minHeight: "100vh",
  },
  backButton: {
    position: "absolute",
    top: "20px",
    left: "20px",
    padding: "8px 12px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#6c757d",
    color: "#fff",
    cursor: "pointer",
  },
  infoBox: {
    margin: "20px auto",
    padding: "15px",
    borderRadius: "8px",
    backgroundColor: "#fff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    width: "300px",
    textAlign: "left",
  },
  buttonGroup: {
    marginTop: "30px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    alignItems: "center",
  },
  actionButton: {
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
    width: "200px",
  },
};

export default UserInfoPage;

