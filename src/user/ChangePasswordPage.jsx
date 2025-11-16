import React, { useState } from "react";
import { changePasswordBg } from "../backgroundImage";

import { initEthers } from "../contract/contractService";

const ChangePasswordPage = ({ onBack }) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage("❌ New password and confirm password do not match");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const { userVaultContract } = await initEthers();

      const tx = await userVaultContract.changePassword(oldPassword, newPassword);
      await tx.wait();

      setMessage("✅ Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setMessage("❌ Change failed: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={{ color: 'black' }}>Change Password</h2>
      <input
        type="password"
        placeholder="Current password"
        value={oldPassword}
        onChange={(e) => setOldPassword(e.target.value)}
        style={styles.input} 
        
      />
      <input
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        style={styles.input}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        style={styles.input}
      />

      <button onClick={handleChangePassword} style={styles.button} disabled={loading}>
        {loading ? "Submitting..." : "Submit"}
      </button>
      <button onClick={onBack} style={styles.backButton}>Back</button>

      {message && <p>{message}</p>}
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
    backgroundImage: `url(${changePasswordBg})`,
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
    color:"black",
  },
  button: {
    padding: "10px 20px",
    margin: "10px",
    fontSize: "16px",
    cursor: "pointer",
  },
  backButton: {
    padding: "8px 16px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: "#ccc",
    border: "none",
  },
};

export default ChangePasswordPage;
