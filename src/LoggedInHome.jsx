import React from "react";
import homepageBg from "./backgroundImage";

const LoggedInHome = ({ userInfo, onPlayClick, onUserInfoClick }) => {
  return (
    <div style={styles.container}>
      {/* User info button in top right */}
      <div style={styles.userInfo}>
        <button style={styles.userButton} onClick={onUserInfoClick}>
          User Info
        </button>
      </div>

      {/* Center content */}
      <div style={styles.centerContent}>
        <button style={styles.playButton} onClick={onPlayClick}>
          Play
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: "relative",
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    backgroundImage: `url(${homepageBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  centerContent: {
    textAlign: "center",
    marginTop: "100px",
  },
  playButton: {
    padding: "30px 60px",
    fontSize: "32px",
    borderRadius: "20px",
    border: "none",
    backgroundColor: "#dc3545",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    minWidth: "200px",
    boxShadow: "0 8px 25px rgba(220, 53, 69, 0.4)",
    transition: "all 0.3s ease",
  },
  userInfo: {
    position: "absolute",
    top: "20px",
    right: "20px",
  },
  userButton: {
    padding: "8px 12px",
    fontSize: "14px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
  },
};

export default LoggedInHome;
