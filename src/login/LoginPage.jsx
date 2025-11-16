import React, { useState } from "react";

import { loginBg } from "../backgroundImage";

import { initEthers } from "../contract/contractService";

const LoginPage = ({ onBack, onLoginSuccess }) => { 
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const { userVaultContract, signer } = await initEthers();

      const tx = await userVaultContract.login(password);
      await tx.wait();

      alert("Login successful!");
      
      const userAddress = await signer.getAddress();
      onLoginSuccess(userAddress);

    } catch (err) {
      console.error(err);
      const errorReason = err?.reason || "Login failed, please check password or if account is registered";
      setErrorMsg(errorReason);
    } finally {
      setLoading(false);
    }
  };

 return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={{ marginBottom: "20px" }}>User Login</h2>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
        <div style={{ marginTop: "10px" }}>
          <button onClick={handleLogin} style={styles.button} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <button onClick={onBack} style={{ ...styles.button, marginLeft: "10px" }}>
            Back
          </button>
        </div>
        {errorMsg && <p style={{ color: "red", marginTop: "10px" }}>{errorMsg}</p>}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundImage: `url(${loginBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  card: {
    padding: "30px",
    borderRadius: "10px",
    backgroundColor: "#fff",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    textAlign: "center",
    minWidth: "300px",
  },
  input: {
    padding: "10px",
    width: "100%",
    marginBottom: "10px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    fontSize: "16px",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
    fontSize: "16px",
  },
};

export default LoginPage;
