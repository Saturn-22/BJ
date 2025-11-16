import React from "react";
import { game1Bg, game2Bg } from "../backgroundImage";

const GamePage = ({ onBack, onSelectGame1, onSelectGame2 }) => {
  const handleButtonClick = (buttonNumber) => {
    if (buttonNumber === 1) return onSelectGame1?.();
    if (buttonNumber === 2) return onSelectGame2?.();
  };

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={onBack}>⬅ Back</button>
      
      <div style={styles.buttonContainer}>
        <div style={styles.leftButton}>
          <div style={styles.leftBackground}></div>
          <button 
            style={styles.gameButton} 
            onClick={() => handleButtonClick(1)}
          >
            Gomoku
          </button>
        </div>
        <div style={styles.divider}></div>
        <div style={styles.rightButton}>
          <div style={styles.rightBackground}></div>
          <button 
            style={styles.gameButton} 
            onClick={() => handleButtonClick(2)}
          >
            BlackJack
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    textAlign: "center",
    minHeight: "100vh",
    position: "relative",
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
  buttonContainer: {
    marginTop: "50px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    height: "60vh",
    padding: "0 50px",
  },
  divider: {
    position: "absolute",
    left: "50%",
    top: "0",
    width: "2px",
    height: "100vh",
    backgroundColor: "#333",
    transform: "translateX(-50%)",
    zIndex: "1",
  },
  leftButton: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "50%",
    height: "100%",
  },
  rightButton: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "50%",
    height: "100%",
  },
  leftBackground: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "50vw",
    height: "100vh",
    backgroundImage: `url(${game1Bg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    zIndex: -1,
  },
  rightBackground: {
    position: "fixed",
    top: 0,
    right: 0,
    width: "50vw",
    height: "100vh",
    backgroundImage: `url(${game2Bg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    zIndex: -1,
  },
  gameButton: {
    padding: "20px 40px",
    fontSize: "24px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
    width: "160px",
    height: "120px",
  },
};

export default GamePage;
