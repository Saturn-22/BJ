import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

import { userInfoBg } from "../backgroundImage";

import { initEthers, getContracts } from "../contract/contractService";

const UserInfoPage = ({ userInfo, onBack, onChangePassword, onLogout, onRecharge, onWithdraw }) => {
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState(userInfo);

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
      alert("✅ Logged out");
      onLogout?.();
    } catch (err) {
      console.error(err);
      alert("❌ Logout failed: " + (err.reason || err.message));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={onBack}>Back</button>

      <h2 style={styles.title}>User Information</h2>
      
      <div style={styles.infoBox}>
        <div><strong>Username:</strong> {currentUserInfo.username}</div>
        <div><strong>Balance:</strong> {ethers.formatEther(currentUserInfo.balance || "0")} ETH</div>
        <div><strong>Status:</strong> {currentUserInfo.frozen ? "❌ Frozen" : "✅ Active"}</div>
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
  title: {
    color: "#000",
    fontSize: "24px", 
    fontWeight: "bold", 
    marginTop: "40px", 
  },
  infoBox: {
    margin: "20px auto",
    padding: "20px",
    borderRadius: "8px",
    backgroundColor: "#fff", 
    color: "#000", 
    boxShadow: "0 2px 10px rgba(0,0,0,0.15)", 
    width: "320px",
    textAlign: "left",
    fontSize: "16px",
    fontFamily: "Arial, sans-serif",
    lineHeight: "1.8",
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
