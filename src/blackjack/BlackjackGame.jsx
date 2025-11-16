// --- Imports ---
import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import './BlackjackGame.css'; // Use the new CSS
import { motion, AnimatePresence } from 'framer-motion';
import Card, { cardName } from './Card'; // Updated import path

// --- ABIs and Addresses ---
import UserVaultSystemABI from '../contract/UserVaultSystemABI.json'; 
import BlackjackArtifact from '../contract/BlackjackABI.json'; 
import { USER_VAULT_ADDRESS, BLACKJACK_ADDRESS } from '../contract/contractConfig';

// Align variable names with App1.js
const userVaultABI = UserVaultSystemABI; 
const blackjackABI = BlackjackArtifact.abi; 
const userVaultAddress = USER_VAULT_ADDRESS;
const blackjackAddress = BLACKJACK_ADDRESS;

// API endpoint
//const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
const API_BASE_URL = 'https://blackjack-dptz.onrender.com';

// --- Helper Functions ---

/** Get the card's numeric value for Blackjack. */
const getCardValue = (cardId) => {
  const rank = cardId % 13;
  if (rank === 0) return 11;       // Ace
  if (rank <= 9) return rank + 1;  // 2–10
  return 10;                       // J, Q, K
};

/** Calculate the total value of a hand, adjusting Aces as needed. */
const getHandTotal = (cards) => {
  let total = 0;
  let aces = 0;
  cards.forEach(cardId => {
    if (typeof cardId !== 'number' || cardId === 99) return;
    const value = getCardValue(cardId);
    total += value;
    if (value === 11) aces += 1;
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
};

/** Determine the result between player and dealer totals. */
const getHandResult = (playerTotal, dealerTotal) => {
  if (playerTotal > 21) return "Lose (Player bust)";
  if (dealerTotal > 21) return "Win (Dealer bust)";
  if (playerTotal > dealerTotal) return "Win";
  if (playerTotal < dealerTotal) return "Lose";
  return "Push";
};
// -----------------------------------------------------------------

function BlackjackGame({ onBack, onBalanceUpdate }) {
  // --- State Variables ---
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [poolBalance, setPoolBalance] = useState('');
  const [vaultContract, setVaultContract] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [userBalance, setUserBalance] = useState('');
  
  const [blackjackContract, setBlackjackContract] = useState(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [currentRoundId, setCurrentRoundId] = useState(null);
  const [gameMessage, setGameMessage] = useState('');
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [currentStake, setCurrentStake] = useState(null);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [hand1Cards, setHand1Cards] = useState([]);
  const [hand2Cards, setHand2Cards] = useState([]);
  const [isSplittable, setIsSplittable] = useState(false);
  const [canDouble, setCanDouble] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [isAceSplit, setIsAceSplit] = useState(false); // <-- [FIX] State for Ace Split
  const [activeHand, setActiveHand] = useState(0);
  const [currentDeckRoot, setCurrentDeckRoot] = useState(null);
  const [lastGameProof, setLastGameProof] = useState(null);
  const [lastPayout, setLastPayout] = useState(null);
  const [gameOutcome, setGameOutcome] = useState(null);
  const cardIdCounterRef = useRef(0);

  const [isLoading, setIsLoading] = useState(false);

  /** Display a temporary status message */
  const showTempStatus = (message, isError = false) => {
    setTxStatus(message);
    setTimeout(() => {
      setTxStatus(prev => (prev === message ? '' : prev));
    }, isError ? 4000 : 3000);
  };

  /** Extract only valid card IDs from a card array. */
  const getCardIds = (cardArray) => cardArray.map(c => c.cardId).filter(id => id !== 99);
  
  /** Helper to create new card objects for reconciliation */
  const createCardObj = (cardId) => ({ id: `card-${cardIdCounterRef.current++}`, cardId: cardId });

  // --- Contract & State Setup ---
  const setupContractsAndState = async (provider, account) => {
    setAccount(account);
    const signer = await provider.getSigner();
    const vault = new ethers.Contract(userVaultAddress, userVaultABI, signer);
    setVaultContract(vault);
    try {
      const blackjack = new ethers.Contract(blackjackAddress, blackjackABI, signer);
      setBlackjackContract(blackjack);
    } catch (error) {
      console.error("Blackjack contract setup failed:", error);
    }
    
    setIsLoading(true);
    setTxStatus("Loading user info...");
    try {
      await Promise.all([
        fetchUserBalance(vault, account),
        fetchPoolBalance(vault),
      ]);
      setIsLoading(false);
      setTxStatus("");
    } catch (error) {
      setIsLoading(false);
      showTempStatus("Failed to load balance", true);
    }
  };

  // --- Wallet Connection & Network Switch ---
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(web3Provider);
        const network = await web3Provider.getNetwork();

        // --- [FIX] Set to Localhost (Ganache/Truffle) ---
        const requiredChainId = 31337;
        const requiredChainIdHex = '0x' + requiredChainId.toString(16); // 0x539
        const config = {
            CHAIN_ID: requiredChainId,
            NETWORK_NAME: "Localhost 31337",
            RPC_URL: "http://127.0.0.1:8545", // Standard Ganache RPC
            BLOCK_EXPLORER_URL: null
        };
        // --- [END FIX] ---

        // if (Number(network.chainId) !== requiredChainId) {
        //   alert(`Please switch MetaMask network to ${config.NETWORK_NAME} (Chain ID: ${config.CHAIN_ID}).`);
        //   try {
        //     await window.ethereum.request({
        //       method: 'wallet_switchEthereumChain',
        //       params: [{ chainId: requiredChainIdHex }],
        //     });
        //   } catch (switchError) {
        //     if (switchError.code === 4902) {
        //       try {
        //         await window.ethereum.request({
        //           method: 'wallet_addEthereumChain',
        //           params: [
        //             {
        //               chainId: requiredChainIdHex,
        //               chainName: config.NETWORK_NAME,
        //               rpcUrls: [config.RPC_URL],
        //               nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        //               blockExplorerUrls: config.BLOCK_EXPLORER_URL ? [config.BLOCK_EXPLORER_URL] : [],
        //             },
        //           ],
        //         });
        //       } catch (addError) {
        //         console.error("Add network failed", addError);
        //         return;
        //       }
        //     } else {
        //       console.error("Switch network failed", switchError);
        //       return;
        //     }
        //   }

        //   const refreshedProvider = new ethers.BrowserProvider(window.ethereum);
        //   setProvider(refreshedProvider);
        //   const refreshedNetwork = await refreshedProvider.getNetwork();
        //   if (Number(refreshedNetwork.chainId) !== requiredChainId) {
        //     alert("Failed to switch to the correct network.");
        //     return;
        //   }
        //   const accounts = await refreshedProvider.send('eth_requestAccounts', []);
        //   if (accounts.length > 0) await setupContractsAndState(refreshedProvider, accounts[0]);
        // } else
           {
          const accounts = await web3Provider.send('eth_requestAccounts', []);
          if (accounts.length > 0) await setupContractsAndState(web3Provider, accounts[0]);
        }
      } catch (error) {
        console.error('MetaMask connection error:', error);
        setAccount(null);
        setProvider(null);
        setVaultContract(null);
        setBlackjackContract(null);
      }
    } else {
      alert('Please install MetaMask extension.');
    }
  };

  // --- [NEW] Automatically connect wallet on mount ---
  useEffect(() => {
    // Automatically try to connect wallet on component mount
    if (!account) {
      connectWallet();
    }
  }, []); // Empty dependency array ensures this runs only once on mount

 // --- Pool Balance Fetch ---
const fetchPoolBalance = async (contractInstance) => {
  const contractToUse = contractInstance || vaultContract;
  if (contractToUse && provider) {
    try {
      const balanceWei = await contractToUse.connect(provider).gamePoolBalance();
      setPoolBalance(ethers.formatEther(balanceWei));
    } catch (error) {
      console.error('Error fetching pool balance:', error);
      setPoolBalance('Failed to read');
      throw error; // Propagate error to caller
    }
  }
};

// --- User Balance Fetch ---
const fetchUserBalance = async (contractInstance, currentAccount) => {
  const contractToUse = contractInstance || vaultContract;
  const accountToUse = currentAccount || account;
  if (contractToUse && accountToUse && provider) {
    try {
      const userInfo = await contractToUse.connect(provider).users(accountToUse);
      setUserBalance(ethers.formatEther(userInfo.balance));
      if (onBalanceUpdate) {
        onBalanceUpdate();
      }
    } catch (error) {
      console.error('Error fetching user balance:', error);
      setUserBalance('0.0');
      throw error;
    }
  }
};

// --- Deposit ---
const handleDeposit = async () => {
  if (vaultContract && depositAmount && provider) {
    setIsLoading(true);
    setTxStatus('Processing...');
    try {
      const signer = await provider.getSigner();
      const contractWithSigner = vaultContract.connect(signer);
      try {
        await contractWithSigner.updateLastActivity();
      } catch (e) {
        console.warn("Update activity before deposit failed", e.reason || e.message);
      }

      const amountWei = ethers.parseEther(depositAmount);
      const tx = await contractWithSigner.deposit({ value: amountWei });
      setTxStatus('Transaction pending...');
      const receipt = await tx.wait();

      setIsLoading(false);
      showTempStatus('Deposit successful!');
      fetchUserBalance(vaultContract, account);
      setDepositAmount('');
    } catch (error) {
      console.error('Deposit failed:', error);
      const reason = error.reason || error.data?.message || error.message;
      setIsLoading(false);
      showTempStatus(`Deposit failed: ${reason}`, true);
      alert(`Deposit failed: ${reason}`);
    }
  } else if (!vaultContract) {
    alert('Wallet not connected.');
  } else {
    alert('Please enter a deposit amount.');
  }
};

// --- Withdraw ---
const handleWithdraw = async () => {
  if (vaultContract && withdrawAmount && provider) {
    setIsLoading(true);
    setTxStatus('Processing withdrawal...');
    try {
      const signer = await provider.getSigner();
      const contractWithSigner = vaultContract.connect(signer);
      const amountWei = ethers.parseEther(withdrawAmount);

      try {
        await contractWithSigner.updateLastActivity();
      } catch (e) {
        console.warn("Update activity before withdrawal failed", e.reason || e.message);
      }

      const tx = await contractWithSigner.withdraw(amountWei);
      setTxStatus('Transaction pending...');
      await tx.wait();

      setIsLoading(false);
      showTempStatus('Withdrawal successful!');
      fetchUserBalance(vaultContract, account);
      setWithdrawAmount('');
    } catch (error) {
      console.error('Withdraw failed:', error);
      const reason = error.reason || error.data?.message || error.message;
      setIsLoading(false);
      showTempStatus(`Withdrawal failed: ${reason}`, true);
      alert(`Withdrawal failed: ${reason}`);
    }
  }
};

// --- Game Logic ---
const handleStartGame = async () => {
    if (!vaultContract || !blackjackContract || !stakeAmount || !provider) { alert('Please ensure you are logged in, contracts are initialized, and bet amount is entered.'); return; }
    if (parseFloat(stakeAmount) <= 0) { alert('Bet amount must be greater than 0.'); return; }

    // [FIX] Reset AceSplit state
    setPlayerCards([]); setDealerCards([]); setHand1Cards([]); setHand2Cards([]); setIsSplit(false); setIsAceSplit(false);
    setActiveHand(0); cardIdCounterRef.current = 0;
    setGameMessage(''); setIsPlayerTurn(false); setCurrentRoundId(null); setTxStatus('Processing game...'); setCurrentDeckRoot(null); setLastGameProof(null); setLastPayout(null);

    setIsLoading(true);
    let pushSucceeded = false;
    let stakeWei;

    try {
        stakeWei = ethers.parseEther(stakeAmount);
        try {
            const maxBet = await blackjackContract.connect(provider).MAX_BET();
            if (stakeWei > maxBet) {
                alert(`Bet amount ${stakeAmount} ETH exceeds the maximum limit ${ethers.formatEther(maxBet)} ETH`);
                setIsLoading(false);
                setTxStatus(''); return;
            }
        } catch (e) { console.warn("Could not fetch MAX_BET", e); }

        const signer = await provider.getSigner();
        const vaultWithSigner = vaultContract.connect(signer);
        const blackjackWithSigner = blackjackContract.connect(signer);

        setCurrentStake(stakeAmount);
        try { const activityTx = await vaultWithSigner.updateLastActivity(); await activityTx.wait(1); }
        catch (sessionError) { console.warn("Update activity failed:", sessionError.reason || sessionError.message); }

        setTxStatus('Pushing bet to pool...'); const pushTx = await vaultWithSigner.pushToPool(stakeWei);
        setTxStatus('Waiting for bet transaction confirmation...'); await pushTx.wait(); setTxStatus('Bet successfully added to pool!');
        pushSucceeded = true;
        fetchUserBalance(vaultContract, account);

        setTxStatus('Fetching encrypted deck data from backend...');
        let apiResponse;
        try {
            const response = await fetch(`${API_BASE_URL}/api/start-game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerAddress: account }), });
            if (!response.ok) { const err = await response.json(); throw new Error(`Backend API error: ${err.error || response.statusText}`); }
            apiResponse = await response.json();
        } catch (apiError) { throw new Error(`Failed to call backend API: ${apiError.message}. (Ensure Flask server is running)`); }
        const { deckRoot, holePos, holeLeaf, initialHand } = apiResponse;
        if (!deckRoot || typeof holePos === 'undefined' || !holeLeaf || !initialHand) throw new Error("Invalid backend response format.");
        setCurrentDeckRoot(deckRoot);

        setTxStatus('Starting round on-chain...');
        const startTx = await blackjackWithSigner.startRound(deckRoot, holePos, holeLeaf, stakeWei);
        setTxStatus('Waiting for round confirmation...'); const startReceipt = await startTx.wait();

        let roundId = null;
        if (startReceipt.logs) { 
            const iface = new ethers.Interface(blackjackABI); 
            for (const log of startReceipt.logs) { 
                try { 
                    const parsedLog = iface.parseLog(log); 
                    if (parsedLog && parsedLog.name === "RoundStarted") { 
                        roundId = parsedLog.args.roundId; break; 
                    } 
                } catch (e) {} 
            } 
        }

        if (roundId !== null) {
            setCurrentRoundId(roundId);
            const { playerCard1, playerCard2, dealerUpCard, isSplittable } = initialHand;
            const p1 = { id: `card-${cardIdCounterRef.current++}`, cardId: playerCard1 };
            const p2 = { id: `card-${cardIdCounterRef.current++}`, cardId: playerCard2 };
            const d1 = { id: `card-${cardIdCounterRef.current++}`, cardId: dealerUpCard };
            const dHole = { id: 'd-hole', cardId: 99, isHole: true };
            setPlayerCards([p1, p2]); setDealerCards([d1, dHole]);
            const playerTotal = getHandTotal(getCardIds([p1, p2]));
            setGameMessage(`Current total: ${playerTotal}. Choose your action:`);
            setIsPlayerTurn(true);
            setIsLoading(false);
            showTempStatus(`Game round ${roundId.toString()} started!`);
            setStakeAmount('');
            if (playerTotal === 21) {
                setIsSplittable(false); setCanDouble(false);
                setIsPlayerTurn(false);
                setGameMessage('Blackjack!');
                setTimeout(() => handleStand(), 1500);
            }
            else { setIsSplittable(isSplittable); setCanDouble(true); }
        } else { throw new Error("Failed to parse roundId from on-chain event."); }
    } catch (error) {
        console.error('Start game failed:', error);
        const reason = error.reason || error.data?.message || error.message;
        setIsLoading(false);
        showTempStatus(`Start game failed: ${reason}`, true);
        alert(`Start game failed: ${reason}`);
        if (pushSucceeded) {
            alert("Note: Bet has been added to pool but game failed to start. Please contact admin for refund.");
            console.error(`REFUND NEEDED for ${account}, amount: ${stakeWei.toString()} wei`);
        }
        setCurrentDeckRoot(null); setCurrentRoundId(null); setCurrentStake(null);
        fetchUserBalance(vaultContract, account);
    }
};

const handleHit = async () => {
    if (!isPlayerTurn || !account || isLoading || !vaultContract || !provider) return;
    setIsLoading(true);
    setTxStatus('Hit...');
    setIsPlayerTurn(false); setCanDouble(false); setIsSplittable(false);
    try {
        // [FIX] Update session before hit to prevent timeout
        const signer = await provider.getSigner();
        const vaultWithSigner = vaultContract.connect(signer);
        try {
            await vaultWithSigner.updateLastActivity();
        } catch (sessionError) {
            console.error("Session update failed before hit:", sessionError);
            throw new Error("Session expired. Please refresh the page and try again.");
        }
        
        const handToHit = isSplit ? activeHand : 0;
        const response = await fetch(`${API_BASE_URL}/api/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerAddress: account, hand: handToHit }), });
        if (!response.ok) { const err = await response.json(); throw new Error(`Hit API error: ${err.error || response.statusText}`); }
        
        // --- [FIX] Trust backend state (Bug 3) ---
        const { newCard, hand, newHandCards: backendCardIds } = await response.json();
        
        let newHandCards;
        let handLabel = "Your hand";

        if (isSplit) {
            if (activeHand === 1) {
                // Reconcile Hand 1
                newHandCards = backendCardIds.map((cardId, index) => 
                    (hand1Cards[index] && hand1Cards[index].cardId === cardId) 
                    ? hand1Cards[index] // Reuse existing object
                    : createCardObj(cardId) // Create new object
                );
                setHand1Cards(newHandCards);
                handLabel = "Hand 1";
            } else {
                // Reconcile Hand 2
                newHandCards = backendCardIds.map((cardId, index) => 
                    (hand2Cards[index] && hand2Cards[index].cardId === cardId) 
                    ? hand2Cards[index] 
                    : createCardObj(cardId)
                );
                setHand2Cards(newHandCards);
                handLabel = "Hand 2";
            }
        } else {
            // Reconcile main hand
            newHandCards = backendCardIds.map((cardId, index) => 
                (playerCards[index] && playerCards[index].cardId === cardId) 
                ? playerCards[index] 
                : createCardObj(cardId)
            );
            setPlayerCards(newHandCards);
        }
        // --- [END FIX] ---

        const total = getHandTotal(getCardIds(newHandCards)); // Total is now based on reconciled state

        if (total > 21) {
            setGameMessage(`${handLabel} busts! Total: ${total}.`);
            if (isSplit && activeHand === 1) {
                showTempStatus(`${handLabel} busts, switching to Hand 2...`);
                // [BUG FIX] Pass an empty object to satisfy switchToHand2's new signature
                // We know it's a bust, so we just need to trigger the switch.
                // We will call handleStand(1) to get the *real* data.
                setTimeout(() => handleStand(), 1500); // <-- This will call /api/stand for hand 1
            } else {
                showTempStatus(`${handLabel} busts, processing...`);
                setTimeout(() => handleStand(total), 1500);
            }
        }
        else {
            setGameMessage(`${handLabel} total: ${total}. Choose your action:`);
            setTxStatus('');
            setIsPlayerTurn(true);
            setIsLoading(false);
        }
    } catch (error) {
        console.error('Hit failed:', error);
        showTempStatus(`Hit failed: ${error.message}`, true);
        setIsPlayerTurn(true);
        setIsLoading(false);
    }
};

// --- [BUG FIX 1 & 2] ---
// `switchToHand2` is now a pure state-updater. It no longer fetches.
// It receives `apiData` directly from `handleStand`.
const switchToHand2 = async (apiData) => {
    setTxStatus('Switching to Hand 2...');

    if (!apiData.handSwitched) {
        throw new Error("Logic Error: API failed to switch hand");
    }

    setActiveHand(apiData.activeHand);
    
    // Get the first card, which was already in state
    const baseHand2Card = hand2Cards.length > 0 ? hand2Cards[0] : null;
    let finalH2Cards = [];

    if (baseHand2Card && apiData.newHand2Cards[0] === baseHand2Card.cardId) {
        // This is the expected path.
        // `newHand2Cards` from backend is [originalCardId, newCardId]
        finalH2Cards = [
            baseHand2Card, // Reuse existing object
            createCardObj(apiData.newHand2Cards[1]) // Create new object for new card
        ];
    } else {
        // Fallback in case state is weird, just use what the backend said
        console.warn("Hand 2 state mismatch, rebuilding from backend data.");
        finalH2Cards = apiData.newHand2Cards.map(createCardObj);
    }

    setHand2Cards(finalH2Cards);
    const hand2Total = getHandTotal(getCardIds(finalH2Cards));
    
    // --- [FIX] Handle Ace Split rule (Bug 2) ---
    if (isAceSplit) {
        setGameMessage(`Split Aces. Hand 2 (Total: ${hand2Total}). Auto-standing...`);
        showTempStatus('Play Hand 2. Auto-standing.');
        setIsPlayerTurn(false);
        setIsLoading(true);
        setIsAceSplit(false); // Reset state
        setTimeout(() => handleStand(), 1500); // Auto-stand to settle
    }
    // --- [END FIX] ---
    else if (hand2Total === 21) {
        setIsLoading(true);
        showTempStatus('Hand 2 has 21, auto standing...');
        setTimeout(() => handleStand(), 1500);
    } else if (hand2Total > 21) { 
        setIsLoading(true);
        setGameMessage(`Your turn: Hand 2 (Total: ${hand2Total}). Bust!`);
        showTempStatus('Hand 2 busts, processing...');
        setTimeout(() => handleStand(hand2Total), 1500); 
    } else {
        setGameMessage(`Your turn: Hand 2 (Total: ${hand2Total}). Choose your action.`);
        showTempStatus('Play Hand 2.');
        // Note: We don't setCanDouble(true) here because the backend /api/double
        // does not currently support doubling split hands.
        setIsPlayerTurn(true);
        setIsLoading(false);
    }
};

const handleSettle = async (settlementData) => {
    if (!account || !currentRoundId || !provider) return;
    setIsLoading(true);
    setIsPlayerTurn(false); setTxStatus("Game ended, settling on-chain...");
    try {
        const signer = await provider.getSigner();
        const blackjackWithSigner = blackjackContract.connect(signer);
        // [FIX] If session update fails, throw error instead of continuing
        const vaultWithSigner = vaultContract.connect(signer);
        try {
            const activityTx = await vaultWithSigner.updateLastActivity();
            await activityTx.wait(1); 
            console.log("User session refreshed before settlement.");
        } catch (sessionError) {
            console.error("Update activity before settlement failed:", sessionError.reason || sessionError.message);
            throw new Error("Session expired. Unable to settle game. Please refresh the page and contact support.");
        }
        const settleArgs = [
            currentRoundId, settlementData.holeCardId, settlementData.holeSalt, settlementData.holeProof,
            settlementData.initial3.map(r => ({ pos: r.pos, cardId: r.cardId, salt: r.salt, proof: r.proof })),
            settlementData.playerExtra.map(r => ({ pos: r.pos, cardId: r.cardId, salt: r.salt, proof: r.proof })),
            settlementData.dealerDraws.map(r => ({ pos: r.pos, cardId: r.cardId, salt: r.salt, proof: r.proof })),
            settlementData.doubled, settlementData.split,
            settlementData.hand1Extra.map(r => ({ pos: r.pos, cardId: r.cardId, salt: r.salt, proof: r.proof })),
            settlementData.hand2Extra.map(r => ({ pos: r.pos, cardId: r.cardId, salt: r.salt, proof: r.proof }))
        ];
        const tx = await blackjackWithSigner.settle(...settleArgs);
        setTxStatus('Settling...'); const receipt = await tx.wait();

        let payoutWei = 0n;
        let payoutFormatted = "0.0";
        if (receipt.logs) {
            const iface = new ethers.Interface(blackjackABI);
            for (const log of receipt.logs) {
                try {
                    const parsedLog = iface.parseLog(log);
                    if (parsedLog && parsedLog.name === "RoundSettled") { 
                        payoutWei = parsedLog.args.payoutWei;
                        break;
                    }
                } catch (e) {}
            }
        }

        const baseStakeWei = ethers.parseEther(currentStake);
        let totalStakeWei = baseStakeWei;
        if (settlementData.doubled || settlementData.split) {
            totalStakeWei = totalStakeWei * 2n;
        }

        const netProfitWei = payoutWei - totalStakeWei;
        const netProfitFormatted = ethers.formatEther(netProfitWei);
        const finalResultString = netProfitWei > 0n ? `+${netProfitFormatted}` : netProfitFormatted;
        setLastPayout(finalResultString);

        try {
            setTxStatus("Fetching fairness proof...");
            const proofResponse = await fetch(`${API_BASE_URL}/api/get-full-deck-reveal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerAddress: account }), });
            if (!proofResponse.ok) { const err = await proofResponse.json(); throw new Error(`Fetch proof failed: ${err.error || proofResponse.statusText}`); }
            const proofData = await proofResponse.json(); setLastGameProof(proofData);
            showTempStatus(`Settlement successful!`);
        } catch (proofError) {
            console.error("Fetch proof failed:", proofError);
            showTempStatus(`Settlement succeeded but proof fetch failed: ${proofError.message}`, true);
        }
        setIsLoading(false);
        fetchUserBalance(vaultContract, account);
        fetchPoolBalance();
        setCurrentRoundId(null); setCurrentDeckRoot(null); setCurrentStake(null);
    } catch (error) {
        console.error('Settle failed:', error);
        const reason = error.reason || error.data?.message || error.message;
        setIsLoading(false);
        showTempStatus(`Settle failed: ${reason}`, true);
        alert(`Settle failed: ${reason}`);
        fetchUserBalance(vaultContract, account);
        fetchPoolBalance();
        // Do not set isPlayerTurn(true) here, game is over.
    }
};

// --- [BUG FIX 1 & 2] ---
// `handleStand` is now the single entry point for all stand actions.
// It handles API calls and delegates to `switchToHand2` or `handleSettle`.
// The `catch` block is fixed to prevent re-enabling controls on error.
const handleStand = async (bustTotal = null) => {
    // Prevent multiple clicks
    if (isLoading && bustTotal === null) return; 

    if (!account || !currentRoundId) {
        console.warn("handleStand called without account or roundId");
        return;
    }

    setIsPlayerTurn(false);
    setIsLoading(true); // Always set loading
    const handToStand = isSplit ? activeHand : 0;
    setTxStatus(`Standing on ${isSplit ? `Hand ${handToStand}` : 'Main hand'}...`);

    try {
        const response = await fetch(`${API_BASE_URL}/api/stand`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ playerAddress: account, hand: handToStand }), 
        });

        if (!response.ok) { 
            const err = await response.json(); 
            const errorMsg = err.error || response.statusText;
            throw new Error(`Stand API error: ${errorMsg}`); 
        }

        const apiData = await response.json();

        if (apiData.handSwitched) {
            // This was Hand 1 standing. Pass data to switchToHand2.
            await switchToHand2(apiData);
        } else { 
            // This was Hand 0 or Hand 2 standing. Time to settle.
            const { settlementData, dealerFullHand } = apiData;
            const baseDealerCard = dealerCards.length > 0 ? dealerCards[0] : null;
            const newDealerCards = dealerFullHand.map((cardId, index) =>
                index === 0 && baseDealerCard ? baseDealerCard : (index === 1 ? { id: 'd-hole', cardId: cardId, isHole: false } : { id: `card-${cardIdCounterRef.current++}`, cardId: cardId })
            );
            setDealerCards(newDealerCards);

            const dealerTotal = getHandTotal(getCardIds(newDealerCards));
            let finalMessage = "";

            if (isSplit) {
                const h1t = getHandTotal(getCardIds(hand1Cards));
                // Use bustTotal if it was passed (e.g., from Hand 2 busting)
                const h2t = (activeHand === 2 && typeof bustTotal === 'number') ? bustTotal : getHandTotal(getCardIds(hand2Cards));
                const r1 = getHandResult(h1t, dealerTotal); 
                const r2 = getHandResult(h2t, dealerTotal); 
                finalMessage = `Dealer: ${dealerTotal}. Hand1 (${h1t}): ${r1}. Hand2 (${h2t}): ${r2}.`; 
            } else { 
                const pt = (typeof bustTotal === 'number') ? bustTotal : getHandTotal(getCardIds(playerCards));
                const r = getHandResult(pt, dealerTotal); 
                finalMessage = `Game over: ${r}`; 
            }

            setGameMessage(finalMessage);
            await handleSettle(settlementData);
        }
    } catch (error) {
        console.error('Stand failed:', error);
        const errorMsg = error.message || "Unknown error";
        showTempStatus(`Stand failed: ${errorMsg}`, true);
        alert(`A critical error occurred: ${errorMsg}\nThe game will now stop. Please start a new game.`);
        
        // [CRITICAL FIX]
        // DO NOT set isPlayerTurn(true). This stops the infinite loop.
        setIsLoading(false);
    }
};

const handleDouble = async () => { 
  // We keep `isSplit` check here because the backend /api/double does not support it
  if (!vaultContract || !currentStake || !isPlayerTurn || !canDouble || isSplit || isLoading || !provider) return;
  setIsLoading(true);
  setIsPlayerTurn(false);
  setTxStatus('Processing double...');
  let pushSucceeded = false;
  let stakeWei;
  try {
      stakeWei = ethers.parseEther(currentStake);
      const signer = await provider.getSigner();
      const vaultWithSigner = vaultContract.connect(signer);

      setTxStatus('Paying additional bet...');
      await vaultWithSigner.updateLastActivity();
      const pushTx = await vaultWithSigner.pushToPool(stakeWei);
      setTxStatus('Waiting for additional bet confirmation...');
      await pushTx.wait();
      setTxStatus('Additional bet paid!');
      pushSucceeded = true;
      fetchUserBalance(vaultContract, account);

      setTxStatus('Fetching double result...');
      const response = await fetch(`${API_BASE_URL}/api/double`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ playerAddress: account }), 
      });
      if (!response.ok) { 
        const err = await response.json(); 
        throw new Error(`Double API error: ${err.error || response.statusText}`); 
      }
      const { settlementData, dealerFullHand, playerFinalCards } = await response.json();
      const newPlayerCards = playerFinalCards.map((cardId, index) =>
          index < playerCards.length ? playerCards[index] : { id: `card-${cardIdCounterRef.current++}`, cardId: cardId }
      );
      setPlayerCards(newPlayerCards);
      const baseDealerCard = dealerCards.length > 0 ? dealerCards[0] : null;
      const newDealerCards = dealerFullHand.map((cardId, index) =>
        index === 0 && baseDealerCard ? baseDealerCard : (index === 1 ? { id: 'd-hole', cardId: cardId, isHole: false } : { id: `card-${cardIdCounterRef.current++}`, cardId: cardId })
      );
      setDealerCards(newDealerCards);
      const playerTotal = getHandTotal(getCardIds(newPlayerCards)); 
      const dealerTotal = getHandTotal(getCardIds(newDealerCards)); 
      const result = getHandResult(playerTotal, dealerTotal);
      setGameMessage(`(Double) ${result}`);
      await handleSettle(settlementData);
  } catch (error) {
      console.error('Double failed:', error);
      const reason = error.reason || error.data?.message || error.message;
      setIsLoading(false); 
      // Do not set isPlayerTurn(true) if settlement failed
      showTempStatus(`Double failed: ${reason}`, true); 
      alert(`Double failed: ${reason}`);
      if (pushSucceeded) {
          alert("Note: Additional bet paid but Double operation failed. Please contact admin for manual handling.");
          console.error(`REFUND/MANUAL SETTLE NEEDED for ${account}, double amount: ${stakeWei?.toString()} wei`);
      }
      fetchUserBalance(vaultContract, account);
  }
};

const handleSplit = async () => {
  if (!vaultContract || !currentStake || !account || !isSplittable || !isPlayerTurn || isLoading || !provider) return;
  if (playerCards.length !== 2) { console.error("Cannot split without exactly 2 cards"); return;}
  setIsLoading(true); 
  setIsPlayerTurn(false); 
  setTxStatus('Processing split...');
  let pushSucceeded = false;
  let stakeWei;
  try {
      // --- [FIX] Check if splitting Aces ---
      const isAces = (playerCards[0].cardId % 13 === 0);
      // --- [END FIX] ---

      stakeWei = ethers.parseEther(currentStake);
      const signer = await provider.getSigner();
      const vaultWithSigner = vaultContract.connect(signer);

      setTxStatus('Paying additional bet...');
      await vaultWithSigner.updateLastActivity();
      const pushTx = await vaultWithSigner.pushToPool(stakeWei);
      setTxStatus('Waiting for additional bet confirmation...');
      await pushTx.wait();
      setTxStatus('Additional bet paid!');
      pushSucceeded = true;
      fetchUserBalance(vaultContract, account);

      setTxStatus('Fetching split result...');
      const response = await fetch(`${API_BASE_URL}/api/split`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ playerAddress: account }), 
      });
      if (!response.ok) { 
        const err = await response.json(); 
        throw new Error(`Split API error: ${err.error || response.statusText}`); 
      }
      const { hand1, hand2 } = await response.json();
      
      // --- [BUG FIX 3] ---
      // Validate backend response to prevent key errors
      if (!hand1 || hand1.length < 2 || typeof hand1[1] === 'undefined' || !hand2 || hand2.length < 1) {
          throw new Error("Split API error: Invalid response from server.");
      }
      
      setIsSplit(true);
      setIsAceSplit(isAces); // <-- [FIX] Set Ace Split state
      const newHand1 = [
        { ...playerCards[0], id: `card-${cardIdCounterRef.current++}` }, // Reuse original card 1
        createCardObj(hand1[1]) // Create new card 2
      ];
      const newHand2 = [
        { ...playerCards[1], id: `card-${cardIdCounterRef.current++}` } // Reuse original card 2
      ];
      setHand1Cards(newHand1);
      setHand2Cards(newHand2);
      setPlayerCards([]); 

      setActiveHand(1); 
      setIsSplittable(false); 
      setCanDouble(false); // Keep as false (backend limitation)
      const hand1Total = getHandTotal(getCardIds(newHand1));
      
      // --- [FIX] Handle Ace Split and 21 (Bug 2) ---
      if (isAces) {
          setGameMessage(`Split Aces. Hand 1 (Total: ${hand1Total}). Auto-standing...`);
          showTempStatus('Play Hand 1. Auto-standing.');
          setIsPlayerTurn(false);
          setIsLoading(true);
          setTimeout(() => handleStand(), 1500); // Auto-stand (will trigger switchToHand2)
      } 
      else if (hand1Total === 21) {
        setIsLoading(true); 
        showTempStatus('Hand 1 has 21 points, auto standing...'); 
        setTimeout(() => handleStand(), 1500);
      }
      else {
        setGameMessage(`Split successful! Playing Hand 1 (Total: ${hand1Total}). Choose your action:`);
        showTempStatus('Play Hand 1.');
        setIsPlayerTurn(true);
        setIsLoading(false); 
      }
      // --- [END FIX] ---

  } catch (error) {
      console.error('Split failed:', error);
      const reason = error.reason || error.data?.message || error.message;
      setIsLoading(false); 
      setIsPlayerTurn(true); 
      showTempStatus(`Split failed: ${reason}`, true); 
      alert(`Split failed: ${reason}`);
      if (pushSucceeded) {
          alert("Note: Additional bet paid but Split operation failed. Please contact admin for manual handling.");
          console.error(`REFUND/MANUAL SETTLE NEEDED for ${account}, split amount: ${stakeWei?.toString()} wei`);
      }
      fetchUserBalance(vaultContract, account);
  }
};

const handleRefreshAllBalances = async () => {
  if (!vaultContract || !account || !provider) {
    showTempStatus("Not connected", true);
    return;
  }
  setIsLoading(true);
  setTxStatus("Refreshing balances...");
  
  try {
    await Promise.all([
      fetchUserBalance(vaultContract, account),
      fetchPoolBalance()
    ]);
    showTempStatus("Refresh successful!");
  } catch (error) {
    console.error("Refresh failed:", error);
    showTempStatus("Refresh failed", true);
  }
  
  setIsLoading(false);
  setTxStatus(prev => (prev === "Refreshing balances..." ? "" : prev));
};

// --- Event Listeners ---
const handleAccountsChangedInternal = (accounts) => {
  const resetGameState = () => {
      setCurrentRoundId(null); 
      setPlayerCards([]); 
      setDealerCards([]); 
      setHand1Cards([]); 
      setHand2Cards([]); 
      setGameMessage(''); 
      setIsPlayerTurn(false); 
      setCurrentStake(null); 
      setIsSplit(false); 
      setIsAceSplit(false); // <-- [FIX] Reset Ace Split state
      setActiveHand(0); 
      setLastGameProof(null); 
      setCurrentDeckRoot(null); 
      setTxStatus('');
      setIsLoading(false);
  };
  if (accounts.length === 0) {
      console.log('Wallet disconnected.');
      setAccount(null); 
      setProvider(null); 
      setVaultContract(null); 
      setBlackjackContract(null);
      setPoolBalance(''); 
      setUserBalance(''); 
      resetGameState();
  } else if (accounts[0] !== account) {
      console.log('Account changed to:', accounts[0]);
      resetGameState();
      if (window.ethereum) {
         const web3Provider = new ethers.BrowserProvider(window.ethereum); 
         setProvider(web3Provider);
         setupContractsAndState(web3Provider, accounts[0]);
      }
  }
};

useEffect(() => {
  if (window.ethereum) {
      const handleAccountsChanged = (accounts) => handleAccountsChangedInternal(accounts);
      const handleChainChanged = (_chainId) => window.location.reload();
      window.ethereum.on('accountsChanged', handleAccountsChanged); 
      window.ethereum.on('chainChanged', handleChainChanged);
      return () => { 
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged); 
        window.ethereum.removeListener('chainChanged', handleChainChanged); 
      };
  }
}, [account]);

// --- Helper: Get Card Style ---
const getCardStyle = (cardArray, index) => {
  const totalCards = cardArray.length;
  const overlap = 45; // px overlap
  const cardWidth = 110; // match CSS
  const totalWidth = cardWidth + (totalCards - 1) * (cardWidth - overlap);
  const startOffset = -totalWidth / 2;
  const offset = startOffset + index * (cardWidth - overlap);
  return {
    top: 0,
    left: `calc(50% + ${offset}px)`,
    zIndex: index,
  };
};


  // --- Render UI ---
return (
  <div className="App">
    {/* ======================= Top Bar ======================= */}
    <header className="app-top-bar">
      <div className="title-bar">
        <button onClick={onBack} className="back-button">← Back</button>
        <h1>Blackjack</h1>
      </div>
      
      {account ? (
        <>
          <div className="account-info">
            Connected Account: <span>{account}</span>
          </div>
          <div className="status-bar">
            <div className="balance-section">
              <div className="balance-info">
                <p>Vault: <span>{userBalance || '0.0'} ETH</span></p>
                <p>Pool: <span>{poolBalance || 'N/A'} ETH</span></p>
              </div>
              <button onClick={handleRefreshAllBalances} className="refresh-button" title="Refresh Balance" disabled={isLoading}>🔄</button>
            </div>
            <div className="status-section">
              {txStatus && <p className={`tx-status ${isLoading ? 'loading' : ''}`}>{txStatus}</p>}
            </div>
            <div className="right-controls">
              <div className="deposit-section">
                <input
                  type="number"
                  placeholder="Deposit ETH"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={isLoading}
                  min="0" step="0.01"
                />
                <button onClick={handleDeposit} disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isLoading}>&nbsp;Deposit&nbsp;&nbsp;</button>
              </div>
              <div className="deposit-section">
                  <input
                      type="number"
                      placeholder="Withdraw ETH"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      disabled={isLoading}
                      min="0" step="0.01"
                  />
                  <button onClick={handleWithdraw} disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isLoading}>
                      Withdraw
                  </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        null
      )}
    </header>

    {/* ======================= Main Content ======================= */}
    {!account ? (
      <div className="main-content-centered">
        <div className="connect-wallet-container">
          <h2>Connecting to Wallet...</h2>
          <p>Please approve the connection in your MetaMask wallet.</p>
          <button onClick={connectWallet} className="wallet-button-main">
            Retry Connection
          </button>
        </div>
      </div>
    ) : (
      // --- Connected: Game Board and Footer ---
      <>
        {/* ======================= Game Board ======================= */}
        <main className="app-main-content">
          <div className="game-board">

            <AnimatePresence>
              {/* --- Dealer Hand --- */}
              <div className="card-hand-zone dealer-zone">
                <div className="hand-label">
                  Dealer: {isPlayerTurn && dealerCards.length > 1 ? getHandTotal(getCardIds(dealerCards).slice(0,1)) : getHandTotal(getCardIds(dealerCards))}
                </div>
                {dealerCards.map((card, index) => (
                  <motion.div
                    key={card.id} layoutId={card.id} className="card-motion-wrapper"
                    style={getCardStyle(dealerCards, index)}
                    initial={{ opacity: 0, y: -50, x: index === 1 ? 20 : 0 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, y: 50, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.1 }}
                  >
                    <Card cardId={card.cardId} isFlipped={isPlayerTurn && card.isHole} />
                  </motion.div>
                ))}
              </div>

              {!isSplit ? (
                // --- Player Hand (Not Split) ---
                <div className="card-hand-zone player-zone">
                   <div className="hand-label active">
                    Player: {getHandTotal(getCardIds(playerCards))}
                   </div>
                  {playerCards.map((card, index) => (
                    <motion.div
                      key={card.id} layoutId={card.id} className="card-motion-wrapper"
                      style={getCardStyle(playerCards, index)}
                      initial={{ opacity: 0, y: 50, x: index === 1 ? -20 : 0 }}
                      animate={{ opacity: 1, y: 0, x: 0 }}
                      exit={{ opacity: 0, y: -50, transition: { duration: 0.2 } }}
                      transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.1 }}
                    >
                      <Card cardId={card.cardId} isFlipped={false} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                // --- Player Hands (Split) ---
                <>
                  <div className="card-hand-zone hand-1-zone">
                    <div className={`hand-label ${activeHand === 1 ? 'active' : ''}`}>
                      Hand 1: {getHandTotal(getCardIds(hand1Cards))}
                    </div>
                    {hand1Cards.map((card, index) => (
                      <motion.div
                        key={card.id} className="card-motion-wrapper" 
                        style={getCardStyle(hand1Cards, index)}
                        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.1 }}
                      >
                        <Card cardId={card.cardId} isFlipped={false} />
                      </motion.div>
                    ))}
                  </div>
                  <div className="card-hand-zone hand-2-zone">
                    <div className={`hand-label ${activeHand === 2 ? 'active' : ''}`}>
                      Hand 2: {getHandTotal(getCardIds(hand2Cards))}
                    </div>
                    {hand2Cards.map((card, index) => (
                      <motion.div
                        key={card.id} className="card-motion-wrapper"
                        style={getCardStyle(hand2Cards, index)}
                        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50, transition: { duration: 0.2 } }}
                        transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.1 }}
                      >
                        <Card cardId={card.cardId} isFlipped={false} />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </AnimatePresence>

            {/* --- Welcome Screen --- */}
            <AnimatePresence>
            {currentRoundId === null && !gameMessage && (
              <motion.div 
                className="welcome-mat"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <img src={process.env.PUBLIC_URL + "/welcome.svg"} alt="Welcome"/>
                <h2>Blackjack</h2>
              </motion.div>
            )}
            </AnimatePresence>

          </div>
        </main>

        {/* ======================= Footer ======================= */}
        <footer className="app-footer">
          {currentRoundId === null ? (
            // --- Before Game Starts ---
            <div className="start-game-controls">
              <div className="start-game-input">
                <input
                  type="number" placeholder="Bet Amount (ETH)" value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  disabled={isLoading}
                  min="0" step="0.01"
                />
                <button onClick={handleStartGame} disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || isLoading}>
                  Start Game
                </button>
              </div>
              {/* --- Previous Round Summary --- */}
              {gameMessage && (
            <div className="game-result-summary">
              <p><b>Last Result: {gameMessage.replace("Game Over: ", "").replace("(Double) ", "")}</b></p>
              {lastPayout !== null && (
                <p><b>Payout: {lastPayout} ETH</b></p>
              )}
              {dealerCards.length > 0 && <p>Dealer Hand: {dealerCards.map(c => cardName(c.cardId)).join(', ')} ({getHandTotal(getCardIds(dealerCards))})</p>}
              {isSplit ? (
                <>
                  {hand1Cards.length > 0 && <p>Player Hand 1: {hand1Cards.map(c => cardName(c.cardId)).join(', ')} ({getHandTotal(getCardIds(hand1Cards))})</p>}
                  {hand2Cards.length > 0 && <p>Player Hand 2: {hand2Cards.map(c => cardName(c.cardId)).join(', ')} ({getHandTotal(getCardIds(hand2Cards))})</p>}
                </>
              ) : (
                playerCards.length > 0 && <p>Player Hand: {playerCards.map(c => cardName(c.cardId)).join(', ')} ({getHandTotal(getCardIds(playerCards))})</p>
              )}
            </div>
          )}
              {/* --- Previous Round Proof --- */}
              {lastGameProof && (
                <div className="proof-container">
                   <h4>Last Round Info</h4>
                   <p><b>Deck Root:</b> <span title={lastGameProof.deckRoot}>{lastGameProof.deckRoot}</span></p>
                   <p><b>Hole Card:</b> {cardName(lastGameProof.holeCardId)} (Pos: {lastGameProof.holePos})</p>
                   <div className="proof-deck-list">
                       <h5>Full Deck:</h5>
                       <pre>
                       {JSON.stringify([
                           { pos: lastGameProof.holePos, cardId: lastGameProof.holeCardId, cardName: cardName(lastGameProof.holeCardId), salt: lastGameProof.holeSalt, isHoleCard: true },
                           ...lastGameProof.reveals.map(reveal => ({ pos: reveal.pos, cardId: reveal.cardId, cardName: cardName(reveal.cardId), salt: reveal.salt }))
                         ].sort((a, b) => a.pos - b.pos), null, 2)
                       }
                       </pre>
                   </div>
                </div>
              )}
            </div>
          ) : (
            // --- During Game ---
            <>
              <h4 className="game-message">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={gameMessage || ' '}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {gameMessage || ' '}
                  </motion.span>
                </AnimatePresence>
              </h4>
              <div className="action-buttons">
                <button onClick={handleHit} disabled={!isPlayerTurn || isLoading}>Hit</button>
                <button onClick={handleStand} disabled={!isPlayerTurn || isLoading}>Stand</button>
                <button
                  onClick={handleDouble}
                  // Keep `isSplit` check because backend /api/double doesn't support it
                  disabled={!isPlayerTurn || !canDouble || isSplit || isLoading}
                  style={ (isPlayerTurn && canDouble && !isSplit && !isLoading) ? {backgroundColor: '#ffc107', color: '#212529'} : {} }
                >Double</button>
                <button
                  onClick={handleSplit}
                  disabled={!isPlayerTurn || !isSplittable || isLoading}
                  style={ (isPlayerTurn && isSplittable && !isLoading) ? {backgroundColor: '#17a2b8', color: 'white'} : {} }
                >Split</button>
              </div>
              {currentDeckRoot && (
              <div className="deck-root-display">
                <p>Deck Root: <span>{currentDeckRoot}</span></p>
              </div>
            )}
            </>
          )}
        </footer>
      </>
    )}
  </div> // End App
);
}

export default BlackjackGame;
