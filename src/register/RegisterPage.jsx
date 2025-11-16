import React, { useState } from "react";

import { registerBg } from "../backgroundImage";

import { initEthers } from "../contract/contractService";

function RegisterPage({ onBack, onRegisterSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    setMessage(""); 

    if (!username || !password || !confirmPassword) {
      setMessage("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const { userVaultContract } = await initEthers();

      const tx = await userVaultContract.registerUser(username, password);
      setMessage("Transaction sent, waiting for block confirmation...");
      await tx.wait(); 
      setMessage("Registration successful!");
      
      setTimeout(() => {
        onRegisterSuccess?.();
      }, 1500); 
    } catch (err) {
      console.error(err);

      let errorMsg = err?.data?.message || err?.reason || err?.message || "Registration failed";
      if (errorMsg.includes("User already registered")) {
        setMessage("You have already registered with this address");
      } else {
        setMessage(errorMsg);
      }
    }
  };

  return (
    <div style={styles.container}>
      <h2>User Registration</h2>
      <input
        style={styles.input}
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        style={styles.input}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        style={styles.input}
        type="password"
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <button style={styles.button} onClick={handleRegister}>
        Register
      </button>
      <button style={styles.backButton} onClick={onBack}>
        Back
      </button>
      {message && <p style={{ color: message.includes("successful") ? "green" : "red" }}>{message}</p>}
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: `url(${registerBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    gap: "12px",
  },
  input: {
    padding: "8px 12px",
    fontSize: "16px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    width: "200px",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#3b82f6",
    color: "white",
    marginTop: "8px",
  },
  backButton: {
    padding: "8px 16px",
    fontSize: "14px",
    borderRadius: "6px",
    border: "1px solid #888",
    cursor: "pointer",
    backgroundColor: "#fff",
    color: "#333",
    marginTop: "4px",
  },
};

export default RegisterPage;
