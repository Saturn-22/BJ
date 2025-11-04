import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
// 绉婚櫎鎵€鏈夋棫鐨勩€佸垎鏁ｇ殑 ABI 鍜屽湴鍧€瀵煎叆
// import { GomokuABI } from "../contract/gomokuABI";
// import { GOMOKU_ADDRESS } from "../contract/gomokuConfig";
// import { CONTRACT_ADDRESS } from "../contract/contractConfig";
// import GomokuArtifact from "../game1/artifacts/contracts/Gomoku.sol/Gomoku.json";
// import { UserVaultABI } from "../contract/contractABI";
import { game1Bg } from "../backgroundImage";

// 导入统一的合约服务
import { initEthers, getContracts } from "../contract/contractService";


const STATUS = {
  0: "Lobby",
  1: "In Progress",
  2: "Finished",
};

const cellStyle = (isMyTurn, value) => ({
  width: 32,
  height: 32,
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

export default function Game1Page({ onBack }) {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [vaultBalance, setVaultBalance] = useState(null);

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [moving, setMoving] = useState(false);

  const [stakeInput, setStakeInput] = useState("");
  const [joinIdInput, setJoinIdInput] = useState("");

  const [currentGameId, setCurrentGameId] = useState(0);
  const [error, setError] = useState("");
  const [openGames, setOpenGames] = useState([]);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // 绠€鍖栫殑鐘舵€佸埛鏂板嚱鏁帮紙澶у巺椤典粎闇€瑕佽处鎴枫€佷綑棰濄€佸綋鍓嶆墍鍦ㄥ灞€ID锛?  
  const refreshState = useCallback(async () => {
    try {
      const { gomokuContract, userVaultContract, signer } = getContracts();
      const currentAccount = await signer.getAddress();
      setAccount(currentAccount);

      // 鑾峰彇鐢ㄦ埛閲戝簱浣欓
      const userInfo = await userVaultContract.getUserInfo();
      setVaultBalance(userInfo.balance);

      // 鑾峰彇鐜╁褰撳墠鎵€鍦ㄧ殑娓告垙
      const gid = await gomokuContract.playerCurrentGame(currentAccount);
      const idNum = Number(gid);
      setCurrentGameId(idNum);
    } catch (e) {
      console.error(e);
      setError(e?.reason || e?.message || "Failed to fetch game state");
    }
  }, []);

  // 鍒濆鍖栧拰浜嬩欢鐩戝惉
  useEffect(() => {
  initEthers()
    .then(() => {
      refreshState();
      // 拉取公开可加入的游戏
      refreshOpenGames();

      // 设置事件监听
      const { gomokuContract } = getContracts();
      gomokuContract.on("MoveMade", (gameId, player, x, y) => {
        console.log(`Event: Move made in game ${gameId} by ${player}`);
        refreshState();
      });
      gomokuContract.on("GameEnded", (gameId, winner, loser) => {
        console.log(`Event: Game ${gameId} ended. Winner: ${winner}`);
        refreshState();
        refreshOpenGames();
      });
      gomokuContract.on("GameStarted", (gameId, p1, p2) => {
        console.log(`Event: Game ${gameId} started between ${p1} and ${p2}`);
        refreshState();
        refreshOpenGames();
      });
      gomokuContract.on("GameCreated", (gameId, p1, stake) => {
        console.log(`Event: Game ${gameId} created by ${p1}`);
        refreshOpenGames();
      });
    })
    .catch((err) => setError(err.message));

  // 清理事件监听
  return () => {
    try {
      const { gomokuContract } = getContracts();
      gomokuContract.removeAllListeners("MoveMade");
      gomokuContract.removeAllListeners("GameEnded");
      gomokuContract.removeAllListeners("GameStarted");
      gomokuContract.removeAllListeners("GameCreated");
    } catch (e) {
      // 如果 getContracts 失败（例如，用户未连接钱包），则忽略
    }
  };
}, [refreshState]);
  
  // ... (绉婚櫎瀹氭椂鍒锋柊鐨?useEffect) ...

  // 鎷夊彇鍏紑鍙姞鍏ョ殑娓告垙鍒楄〃锛圠obby 涓旀湭鏈夌浜屼綅鐜╁锛?  
  const refreshOpenGames = useCallback(async () => {
    try {
      setLoadingOpen(true);
      const { gomokuContract } = getContracts();
      const counter = Number(await gomokuContract.gameCounter());
      const limit = 80; // 鏈€澶氬悜鍚庢煡鐪?80 灞€锛岄伩鍏嶈繃澶?RPC
      const start = Math.max(1, counter - limit + 1);
      const ids = Array.from({ length: counter - start + 1 }, (_, i) => start + i).reverse();

      const details = await Promise.all(
        ids.map(async (id) => {
          try {
            const d = await gomokuContract.getGameDetails(id);
            return { id, d };
          } catch {
            return null;
          }
        })
      );

      const zero = ethers.ZeroAddress;
      const list = details
        .filter(Boolean)
        .map(({ id, d }) => ({
          id,
          creator: d.players?.[0],
          opponent: d.players?.[1],
          status: Number(d.status),
          stake: d.stake,
        }))
        .filter((g) => g.status === 0 && (!g.opponent || g.opponent === zero));

      setOpenGames(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOpen(false);
    }
  }, []);

  const balanceEnoughForCreate = useMemo(() => {
    if (!vaultBalance || !stakeInput) return true; // Typing
    try {
        const stakeWei = ethers.parseEther(stakeInput);
        return ethers.toBigInt(vaultBalance) >= stakeWei;
    } catch { return true; }
  }, [vaultBalance, stakeInput]);


  const handleCreate = async () => {
    try {
      setCreating(true);
      setError("");
      const { gomokuContract } = getContracts();
      const stakeWei = ethers.parseEther(stakeInput);
      if (!stakeWei || stakeWei <= 0) {
        setError("Invalid stake amount");
        return;
      }
      if (!balanceEnoughForCreate) { setError("Insufficient vault balance for stake"); return; }
      const tx = await gomokuContract.createGame(stakeWei);
      await tx.wait();
      // 璺宠浆鍒扮帺瀹跺綋鍓嶆墍鍦ㄥ灞€
      const { signer, gomokuContract: gc } = getContracts();
      const me = await signer.getAddress();
      const gid = Number(await gc.playerCurrentGame(me));
      if (gid > 0) navigate(`/game1/${gid}`);
    } catch (e) {
      console.error(e);
      setError(e?.reason || e?.message || "Create game failed");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (idOverride) => {
    try {
        setJoining(true);
        setError("");
        const { gomokuContract } = getContracts();
        const id = idOverride != null ? Number(idOverride) : Number(joinIdInput);
        if (!id || id <= 0) {
            setError("Invalid game ID");
            return;
        }
        // 注意：此处 balanceEnoughForJoin 的逻辑可能需要根据游戏大厅的具体情况调整
        // 为简化，我们暂时假设用户知道要加入的游戏的赌注
        const tx = await gomokuContract.joinGame(id);
        await tx.wait();
        // 加入成功后跳转至对局
        navigate(`/game1/${id}`);
      } catch (e) {
        console.error(e);
        setError(e?.reason || e?.message || "Join game failed");
      } finally {
        setJoining(false);
      }
  };

  // 澶у巺椤典笉澶勭悊妫嬬洏钀藉瓙
  const handleCancel = async (id) => {
    try {
      setCancellingId(id);
      const { gomokuContract } = getContracts();
      const tx = await gomokuContract.cancelGame(id);
      await tx.wait();
      await refreshOpenGames();
      await refreshState();
    } catch (e) {
      console.error(e);
      setError(e?.reason || e?.message || "Cancel game failed");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={onBack}>Back</button>
      <h2 style={{ color: "#fff" }}>Gomoku</h2>
      {error && <div style={styles.error}>{error}</div>}

      {/* 绉婚櫎浜嗗湴鍧€璁剧疆鍜岄儴缃茬殑 UI */}

      <div style={styles.stateCard}>
        <div><strong>Your Vault Balance:</strong> {vaultBalance ? `${ethers.formatEther(vaultBalance)} ETH` : "-"}</div>
        {!balanceEnoughForCreate && stakeInput && (
          <div style={styles.warn}>Insufficient balance to create with current stake.</div>
        )}
        {currentGameId > 0 && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 14 }}>Current game: #{currentGameId}</div>
            <button
              style={styles.primaryBtn}
              onClick={() => navigate(`/game1/${currentGameId}`)}
            >
              Enter
            </button>
          </div>
        )}
      </div>

  <div style={styles.actionsRow}>
        {/* ... Create Game card ... */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Create Game</div>
          <input
            type="number"
            placeholder="Stake in ETH"
            min="0"
            value={stakeInput}
            onChange={(e) => setStakeInput(e.target.value)}
            style={styles.input}
          />
          <button disabled={creating || !account} onClick={handleCreate} style={styles.primaryBtn}>
            {creating ? "Creating..." : "Create"}
          </button>
          {/* Removed game pool pre-transfer hint */}
  </div>

        {/* ... Join Game card ... */}
        <div style={styles.card}>
            <div style={styles.cardTitle}>Join Game</div>
            <input
                type="number"
                placeholder="Game ID"
                min="1"
                value={joinIdInput}
                onChange={(e) => setJoinIdInput(e.target.value)}
                style={styles.input}
            />
            <button disabled={joining || !account} onClick={() => handleJoin()} style={styles.primaryBtn}>
                {joining ? "Joining..." : "Join"}
            </button>
        </div>
      </div>

      {/* 宸插垱寤虹殑鍏紑瀵瑰眬鍒楄〃锛堢Щ鍔ㄥ埌鍒涘缓/鍔犲叆涔嬩笅锛?*/}
      <div style={styles.listCard}>
        <div style={styles.cardTitle}>Open Games</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button style={styles.secondaryBtn} onClick={refreshOpenGames} disabled={loadingOpen}>
            {loadingOpen ? "Refreshing..." : "Refresh"}
          </button>
          <div style={{ fontSize: 12, color: "#555" }}>
            {openGames.length} available
          </div>
        </div>
        {openGames.length === 0 ? (
          <div style={styles.hint}>No open games. Create one to start!</div>
        ) : (
          <div>
            {/* 琛ㄥご */}
            <div style={{ ...styles.row, fontWeight: 600, borderTop: "none", paddingTop: 0 }}>
              <div style={{ flex: 1 }}>ID</div>
              <div style={{ flex: 3 }}>Creator</div>
              <div style={{ flex: 3 }}>Stake</div>
              <div style={{ flex: 2 }}>Action</div>
            </div>
            {openGames.map((g) => {
              const canJoin = account && (!vaultBalance || (() => { try { return ethers.toBigInt(vaultBalance) >= g.stake; } catch { return true; } })());
              const isCreator = account && g.creator && account.toLowerCase() === g.creator.toLowerCase();
              return (
                <div key={g.id} style={styles.row}>
                  <div style={{ flex: 1 }}>#{g.id}</div>
                  <div style={{ flex: 3, overflow: "hidden", textOverflow: "ellipsis" }}>{shorten(g.creator)}</div>
                  <div style={{ flex: 3 }}>{ethers.formatEther(g.stake)} ETH</div>
                  <div style={{ flex: 2 }}>
                    {isCreator ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          style={styles.primaryBtn}
                          onClick={() => navigate(`/game1/${g.id}`)}
                        >
                          Enter
                        </button>
                        <button
                          style={styles.dangerBtn}
                          disabled={cancellingId === g.id}
                          onClick={() => handleCancel(g.id)}
                        >
                          {cancellingId === g.id ? "Cancelling..." : "Cancel"}
                        </button>
                      </div>
                    ) : (
                      <button
                        style={styles.primaryBtn}
                        disabled={joining || !account || !canJoin}
                        onClick={() => handleJoin(g.id)}
                      >
                        {joining ? "Joining..." : "Join"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 鍘绘帀瀵瑰眬璇︽儏涓庢鐩樺睍绀猴紝淇濇寔澶у巺鍔熻兘 */}
    </div>
  );
}

function shorten(addr) {
  if (!addr) return "-";
  try {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  } catch {
    return String(addr);
  }
}

// 鍙栨秷娓告垙鎸夐挳缁勪欢锛堜粎鍦ㄥぇ鍘呯姸鎬佺敱鍒涘缓鑰呮樉绀猴級
// 鍙栨秷娓告垙鎸夐挳宸茬Щ鍔ㄥ埌瀵瑰眬椤甸潰 GomokuPlay.jsx 涓?
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
  actionsRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 60,
    marginBottom: 12,
  },
  card: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 16,
    minWidth: 260,
  },
  cardTitle: {
    fontWeight: 600,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: 6,
    marginBottom: 8,
  },
  primaryBtn: {
    padding: "8px 14px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "8px 14px",
    backgroundColor: "#dc3545",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "6px 10px",
    backgroundColor: "#e9ecef",
    color: "#222",
    border: "1px solid #d6d9dd",
    borderRadius: 6,
    cursor: "pointer",
  },
  hint: {
    fontSize: 12,
    color: "#555",
    marginTop: 8,
  },
  stateCard: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  listCard: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: "min(680px, 100%)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderTop: "1px solid rgba(0,0,0,0.05)",
  },
  error: {
    background: "#ffe5e5",
    color: "#b00000",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  warn: {
    background: "#fff7e6",
    color: "#8a5300",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  ok: {
    background: "#ecfff0",
    color: "#0a6b2b",
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
    boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
  },
  boardRow: {
    display: "flex",
    gap: 2,
  },
};








