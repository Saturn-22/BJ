import React, { useState } from "react";
import { ethers } from "ethers"; 
import { rechargeBg } from "../backgroundImage";

import { initEthers } from "../contract/contractService";

const RechargePage = ({ onBack, onSubmit }) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      const { userVaultContract } = await initEthers();

      const tx = await userVaultContract.deposit({ value: ethers.parseEther(String(amount)) });
      await tx.wait();

      alert("✅ Recharge successful");
      onSubmit?.(amount);
    } catch (err) {
      console.error(err);
      alert("❌ Recharge failed: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={{ color: 'black' }}>Recharge</h2>
      <input
        type="number"
        placeholder="Enter amount"
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
    backgroundImage: `url(${rechargeBg})`,
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

export default RechargePage;
