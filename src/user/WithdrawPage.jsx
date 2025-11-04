import React, { useState } from "react";
import { ethers } from "ethers"; // 保留 ethers 用于 parseEther
// 移除旧的合约导入
// import { UserVaultABI } from "../contract/contractABI";
// import { CONTRACT_ADDRESS } from "../contract/contractConfig";
import { withdrawBg } from "../backgroundImage";

// 导入新的合约服务
import { initEthers } from "../contract/contractService";

const WithdrawPage = ({ onBack, onSubmit }) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    try {
      setLoading(true);
      // 使用新的服务获取合约实例
      const { userVaultContract } = await initEthers();

      // 调用 withdraw 函数，并使用 ethers v6 的方法
      const tx = await userVaultContract.withdraw(ethers.parseEther(String(amount)));
      await tx.wait();

      alert("✅ Withdraw successful");
      onSubmit?.(amount);
    } catch (err) {
      console.error(err);
      alert("❌ Withdraw failed: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Withdraw</h2>
      <input
        type="number"
        placeholder="Enter withdraw amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={styles.input}
        min="0"
      />
      <button onClick={handleSubmit} style={styles.button} disabled={loading}>{loading ? "Submitting..." : "Submit"}</button>
      <button onClick={onBack} style={styles.backButton}>Back</button>
    </div>
  );
};

const styles = {
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: "center",
    backgroundImage: `url(${withdrawBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    padding: "20px",
    overflow: "auto",
  },
  input: {
    display: "block",
    margin: "10px auto",
    padding: "8px",
    fontSize: "16px",
    width: "250px",
  },
  button: {
    padding: "10px 20px",
    margin: "10px",
    fontSize: "16px",
    cursor: "pointer",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
  },
  backButton: {
    padding: "8px 16px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: "#ccc",
    border: "none",
    borderRadius: "5px",
  },
};

export default WithdrawPage;


