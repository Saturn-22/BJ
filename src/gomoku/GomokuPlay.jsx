import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { game1Bg } from "../backgroundImage";
import { getContracts } from "../contract/contractService";

const CELL_SIZE = 32;

// Classic white cell style
const cellStyleClassic = (isMyTurn, value) => ({
  width: CELL_SIZE,
  height: CELL_SIZE,
  border: "1px solid #ddd",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  borderRadius: 6,
  transition: "background-color 120ms ease, transform 80ms ease",
  cursor: value === 0 && isMyTurn ? "pointer" : "default",
  backgroundColor: value === 0 && isMyTurn ? "#f7fbff" : "#fff",
  boxShadow: "inset 0 0 2px rgba(0,0,0,0.05)",
});

// Wood cell style: draw grid with per-cell right/bottom borders; no outer edge
const cellStyleWood = (isMyTurn, value, x, y, size) => ({
  width: CELL_SIZE,
  height: CELL_SIZE,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  transition: "background-color 120ms ease, transform 80ms ease",
  cursor: value === 0 && isMyTurn ? "pointer" : "default",
  background: value === 0 && isMyTurn ? "#f3e1b7" : "#f6e3b4",
  // only draw inner grid lines
  borderTop: "none",
  borderLeft: "none",
  borderRight: y === size - 1 ? "none" : "1px solid #b78b45",
  borderBottom: x === size - 1 ? "none" : "1px solid #b78b45",
});

const getCellStyle = (theme, isMyTurn, value, x, y, size) => {
  if (theme === 'wood') return cellStyleWood(isMyTurn, value, x, y, size);
  return cellStyleClassic(isMyTurn, value);
}
// Use a fixed-diameter stone for both colors
const STONE_SIZE = 24;
const stoneStyle = (cell) => {
  const base = {
    width: STONE_SIZE,
    height: STONE_SIZE,
    borderRadius: '50%'
  };
  if (cell === 1) {
    return {
      ...base,
      background: '#222'
    };
  }
  if (cell === 2) {
    return {
      ...base,
      background: '#fafafa',
      border: '1px solid rgba(0,0,0,0.1)'
    };
  }
  return base;
};;


const STATUS = { 0: "Lobby", 1: "In Progress", 2: "Finished" };

export default function GomokuPlay() {
  const { id } = useParams();
  const gameId = Number(id) || 0;
  const navigate = useNavigate();
  const [boardTheme, setBoardTheme] = useState(() => {
    try { return localStorage.getItem('gomokuBoardTheme') || 'classic'; } catch { return 'classic'; }
  });
  useEffect(() => { try { localStorage.setItem('gomokuBoardTheme', boardTheme); } catch {} }, [boardTheme]);
  const [account, setAccount] = useState(null);
  const [gameDetails, setGameDetails] = useState(null);
  const [board, setBoard] = useState([]);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const [endedNotified, setEndedNotified] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultText, setResultText] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { gomokuContract, signer } = getContracts();
      const currentAccount = await signer.getAddress();
      setAccount(currentAccount);

      if (gameId > 0) {
        const details = await gomokuContract.getGameDetails(gameId);
        setGameDetails({
          gameId: Number(details.gameId),
          players: details.players,
          turn: details.turn,
          status: Number(details.status),
          winner: details.winner,
          stake: details.stake,
          moveCount: Number(details.moveCount),
        });
        const b = await gomokuContract.getBoard(gameId);
        setBoard(b.map((row) => row.map((n) => Number(n))));
      }
    } catch (e) {
      console.error(e);
      setError(e?.reason || e?.message || "Failed to fetch game state");
    }
  }, [gameId]);

  useEffect(() => {
    refresh();
    try {
      const { gomokuContract } = getContracts();
      gomokuContract.on("MoveMade", () => refresh());
      gomokuContract.on("GameEnded", () => refresh());
      gomokuContract.on("GameStarted", () => refresh());
      return () => {
        try {
          gomokuContract.removeAllListeners("MoveMade");
          gomokuContract.removeAllListeners("GameEnded");
          gomokuContract.removeAllListeners("GameStarted");
        } catch {}
      };
    } catch {}
  }, [refresh]);

  // Result overlay: show once when game ends
  useEffect(() => {
    if (!gameDetails || !account) return;
    if (gameDetails.status === 2 && !endedNotified) {
      const isDraw = gameDetails.winner === ethers.ZeroAddress;
      const iWin = !isDraw && (gameDetails.winner?.toLowerCase() === account.toLowerCase());
      const msg = isDraw ? 'Game ended in a draw.' : (iWin ? 'You win!' : 'You lose.');
      setResultText(msg);
      setResultVisible(true);
      setEndedNotified(true);
    }
    if (gameDetails.status !== 2 && endedNotified) {
      setEndedNotified(false);
      setResultVisible(false);
      setResultText("");
    }
  }, [gameDetails?.status, gameDetails?.winner, account, endedNotified]);

  // Periodic refresh of game details and board every 500ms
  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
    }, 50);
    return () => clearInterval(timer);
  }, [refresh]);

  // Result overlay: show once when game ends
  useEffect(() => {
    if (!gameDetails || !account) return;
    if (gameDetails.status === 2 && !endedNotified) {
      const isDraw = gameDetails.winner === ethers.ZeroAddress;
      const iWin = !isDraw && (gameDetails.winner?.toLowerCase() === account.toLowerCase());
      const msg = isDraw ? 'Game ended in a draw.' : (iWin ? 'You win!' : 'You lose.');
      setResultText(msg);
      setResultVisible(true);
      setEndedNotified(true);
    }
    if (gameDetails.status !== 2 && endedNotified) {
      setEndedNotified(false);
      setResultVisible(false);
      setResultText("");
    }
  }, [gameDetails?.status, gameDetails?.winner, account, endedNotified]);

  const myTurn = useMemo(() => {
    if (!gameDetails || !account) return false;
    return (
      gameDetails.turn?.toLowerCase() === account.toLowerCase() &&
      gameDetails.status === 1
    );
  }, [gameDetails, account]);

  const handleMove = async (x, y) => {
    if (!myTurn || board[x][y] !== 0) return;
    try {
      setMoving(true);
      setError("");
      const { gomokuContract } = getContracts();
      const tx = await gomokuContract.makeMove(gameId, x, y);
      await tx.wait();
    } catch (e) {
      console.error(e);
      setError(e?.reason || e?.message || "Move failed");
    } finally {
      setMoving(false);
    }
  };

  const goBack = () => navigate("/game1");

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={goBack}>Back</button>
      <h2 style={{ color: "#fff" }}>Gomoku</h2>
      {error && <div style={styles.error}>{error}</div>}

      {gameDetails && (
        <div style={styles.stateCard}>
          <div><strong>Game:</strong> #{gameDetails.gameId}</div>
          <div><strong>Status:</strong> {STATUS[gameDetails.status] || gameDetails.status}</div>
          <div><strong>Player 1 (Black):</strong> {gameDetails.players?.[0]}</div>
          <div><strong>Player 2 (White):</strong> {gameDetails.players?.[1] || "-"}</div>
          <div><strong>Turn:</strong> {gameDetails.turn}</div>
          <div><strong>Stake:</strong> {ethers.formatEther(gameDetails.stake || 0)} ETH</div>
          {gameDetails.status === 2 && (
            <div><strong>Winner:</strong> {gameDetails.winner === ethers.ZeroAddress ? "Draw" : gameDetails.winner}</div>
          )}
          {gameDetails.status === 0 && account && gameDetails.players?.[0] &&
            account.toLowerCase() === gameDetails.players[0].toLowerCase() && (
              <CancelGameButton gameId={gameId} onAfter={refresh} />
          )}
        </div>
      )}

      {/* Theme selector */}
      <div style={styles.toolbar}>
        <label style={{ marginRight: 8 }}>Theme:</label>
        <select value={boardTheme} onChange={(e) => setBoardTheme(e.target.value)} style={styles.select}>
          <option value="classic">Classic</option>
          <option value="wood">Wood</option>
        </select>
      </div>

      {board && board.length > 0 && (() => {
        const size = board.length;
        const gap = boardTheme === 'wood' ? 0 : 2;
        // generate letters skipping 'I' (A, B, C, D, E, F, G, H, J, K, ...)
        const topLetters = (() => {
          const out = [];
          let code = 65; // 'A'
          while (out.length < size) {
            const ch = String.fromCharCode(code);
            if (ch !== 'I') out.push(ch);
            code++;
          }
          return out;
        })();
        const padding = 12; // matches styles.board/styles.boardWood padding
        const border = boardTheme === 'wood' ? 3 : 1; // outer border thickness
        // per-cell accumulated border for center stride (classic=2px, wood=1px)
        const hBorder = boardTheme === 'wood' ? 1 : 2;
        const vBorder = boardTheme === 'wood' ? 1 : 2;
        const innerWidth = size * CELL_SIZE + gap * (size - 1);
        const innerHeight = innerWidth; // square board

        return (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Board container */}
            <div style={{ ...(boardTheme === 'wood' ? styles.boardWood : styles.board), position: 'relative' }}>
              {board.map((row, x) => (
                <div key={x} style={{ ...styles.boardRow, gap }}>
                  {row.map((cell, y) => (
                    <div
                      key={`${x}-${y}`}
                      style={{
                        ...getCellStyle(boardTheme, myTurn, cell, x, y, size),
                        color: cell === 1 ? '#111' : cell === 2 ? '#6b7280' : '#333',
                      }}
                      onClick={() => handleMove(x, y)}
                      title={`${topLetters[y]}${x + 1}`}
                    >
                      {cell !== 0 && <div style={stoneStyle(cell)} />}
                    </div>
                  ))}
                </div>
              ))}

              {/* Top letter labels (absolute per column to avoid drift) */}
              {topLetters.map((ch, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left:
                      padding + i * (CELL_SIZE + gap + hBorder) + ((boardTheme === 'wood' && i === size - 1) ? (CELL_SIZE / 2) : ((CELL_SIZE + hBorder) / 2)),
                    transform: 'translateX(-50%)',
                    height: padding,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    color: '#5c3b12',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 0,
                    width: CELL_SIZE,
                  }}
                >
                  {ch}
                </div>
              ))}

              {/* Left numeric labels (absolute per row to avoid drift) */}
              {Array.from({ length: size }, (_, i) => i + 1).map((n, r) => (
                <div
                  key={n}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top:
                      // 起点从棋盘内容区开始：padding（绝对定位相对内容区，不加 board 边框）
                      padding +
                      // 纵向每行步长：格高 + 单元格边框厚度（Classic=2，Wood=1），不包含横向 gap
                      r * (CELL_SIZE + vBorder) +
                      // 半格偏移；Wood 最后一行无下边线，单独使用 CELL_SIZE/2
                      ((boardTheme === 'wood' && r === size - 1) ? (CELL_SIZE / 2) : ((CELL_SIZE + vBorder) / 2)),
                    transform: 'translateY(-50%)',
                    width: padding,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    color: '#5c3b12',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {resultVisible && (
        <div style={styles.overlay}>
          <div style={styles.resultCard}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Game Result</div>
            <div style={{ marginBottom: 12 }}>{resultText}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button style={styles.primaryBtn} onClick={() => setResultVisible(false)}>Close</button>
              <button style={styles.secondaryBtn} onClick={() => navigate("/game1")}>Back to Lobby</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CancelGameButton({ gameId, onAfter }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const onCancel = async () => {
    try {
      setBusy(true);
      setErr("");
      const { gomokuContract } = getContracts();
      const tx = await gomokuContract.cancelGame(gameId);
      await tx.wait();
      onAfter?.();
    } catch (e) {
      console.error(e);
      setErr(e?.reason || e?.message || "Cancel failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={onCancel} style={styles.primaryBtn} disabled={busy}>
        {busy ? "Cancelling..." : "Cancel Game"}
      </button>
      {err && <div style={styles.error}>{err}</div>}
    </div>
  );
}

const styles = {
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundImage: `url(${game1Bg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    padding: "8px 12px",
    borderRadius: 5,
    border: "none",
    backgroundColor: "#6c757d",
    color: "#fff",
    cursor: "pointer",
  },
  stateCard: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  primaryBtn: {
    padding: "8px 14px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "8px 14px",
    backgroundColor: "#e9ecef",
    color: "#222",
    border: "1px solid #d6d9dd",
    borderRadius: 6,
    cursor: "pointer",
  },
  error: {
    background: "#ffe5e5",
    color: "#b00000",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  board: {
    display: "inline-block",
    margin: "24px auto",
    padding: 12,
    background: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.03), 0 6px 20px rgba(0,0,0,0.15)",
  },
  boardWood: {
    display: "inline-block",
    margin: "24px auto",
    padding: 12,
    background: "#f6e3b4",
    borderRadius: 12,
    border: "3px solid #5c3b12",
    boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
  },
  boardRow: {
    display: "flex",
    gap: 2,
  },
  toolbar: {
    alignSelf: "flex-end",
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 8,
    padding: "6px 8px",
    marginTop: 8,
    marginBottom: 4,
  },
  select: {
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
  },
};















