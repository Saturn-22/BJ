// src/components/LoggedOutHome.jsx
import React from "react";
import homepageBg from "./backgroundImage";

const LoggedOutHome = ({ onRegisterClick, onLoginClick, onPlayClick }) => {
  return (
    <div style={styles.container}>
      <h1>Welcome</h1>
      <div style={styles.buttons}>
        <button onClick={onRegisterClick} style={styles.button}>register</button>
        <button onClick={onLoginClick} style={styles.button}>login</button>
      </div>
      <button onClick={onPlayClick} style={styles.playButton}>Play</button>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundImage: `url(${homepageBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  buttons: {
    marginTop: "20px",
    display: "flex",
    gap: "10px",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
  },
  playButton: {
    marginTop: "30px",
    padding: "20px 40px",
    fontSize: "24px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#dc3545",
    color: "#fff",
    cursor: "pointer",
  },
};

export default LoggedOutHome;
