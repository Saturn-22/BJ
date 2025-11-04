// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


interface IUserVaultSystem {
    function scoopFromPool(address to, uint256 amount) external;
    function gamePoolBalance() external view returns (uint256);
}

/* ========= BlackjackSettlement (vault-settled, with split) ========= */
/// @title BlackjackSettlement - Off-chain play, on-chain verify & settle (vault-paying, split supported)
/// @notice Commit a Merkle root of a shuffled deck. Play off-chain. At the end,
///         call `settle` with proofs for only the cards used. The contract
///         re-verifies and computes payout under S17 (stand on all 17).
///         Winnings are credited via the external vault using `scoopFromPool`.
contract BlackjackSettlement {
    // ---------- Types ----------
    struct Round {
        address player;
        uint128 stakeWei;       // base stake per hand (player should have pushed into the vault pool)
        bytes32 deckRoot;
        uint8   holePos;        // reserved position for dealer hole
        bytes32 holeLeaf;       // keccak(cardId||salt) at holePos
        bool    settled;
    }

    struct Reveal {
        uint8   pos;            // deck index (0..51), must be the next undealt pos (holePos skipped)
        uint8   cardId;         // 0..51 (0=A♣ .. 51=K♠)
        bytes32 salt;           // 32-byte random salt used in the leaf
        bytes32[] proof;        // Merkle siblings from leaf up to root
    }

    // Running-total helper (keeps stack small vs big arrays)
    struct Run { uint8 total; uint8 aces; uint8 count; }

    IUserVaultSystem public vault;          // external bankroll
    uint256 public nextRoundId;
    mapping(uint256 => Round) public R;     // roundId -> Round

    uint256 public constant MAX_BET = 1 ether;

    // ---------- Events ----------
    event RoundStarted(
        uint256 indexed roundId,
        address indexed player,
        uint128 stakeWei,
        bytes32 deckRoot,
        uint8 holePos,
        bytes32 holeLeaf
    );

    event RoundSettled(
        uint256 indexed roundId,
        address indexed player,
        uint128 stakeWei,
        uint128 payoutWei,
        uint8[] playerCards,     // flat list; for split this is [P1, P2, hand1Extra..., hand2Extra...]
        uint8 dealerUp,
        uint8 dealerHole,
        uint8[] dealerDraws
    );

    constructor(address vaultAddr) {
        vault = IUserVaultSystem(vaultAddr);
    }

    // ---------- Totals helper ----------
    function _add(Run memory r, uint8 cardId) private pure returns (Run memory) {
        uint8 rank = cardId % 13;
        uint8 v = (rank == 0) ? 11 : (rank <= 9 ? rank + 1 : 10); // A=11, 2..10, JQK=10
        uint8 t = r.total + v;
        uint8 a = r.aces + (rank == 0 ? 1 : 0);
        while (t > 21 && a > 0) { t -= 10; a--; }
        return Run({ total: t, aces: a, count: r.count + 1 });
    }

    // ---------- Player flow ----------
    /// @notice Start a round by committing the deck. Player must have reserved `stakeWei` in the vault pool beforehand.
    function startRound(bytes32 deckRoot, uint8 holePos, bytes32 holeLeaf, uint128 stakeWei)
        external
        returns (uint256 roundId)
    {
        require(stakeWei > 0 && stakeWei <= MAX_BET, "BET");
        // light sanity: pool has funds (not a strict guarantee; solvency enforced by vault ops)
        require(vault.gamePoolBalance() >= stakeWei, "POOL");

        roundId = ++nextRoundId;
        R[roundId] = Round({
            player: msg.sender,
            stakeWei: stakeWei,
            deckRoot: deckRoot,
            holePos: holePos,
            holeLeaf: holeLeaf,
            settled: false
        });
        emit RoundStarted(roundId, msg.sender, stakeWei, deckRoot, holePos, holeLeaf);
    }

    // ---------- Settlement ----------
    /// @notice Verify used cards (Merkle), recompute blackjack under S17, and credit payout via vault.
    /// @dev If `split` is true:
    ///      - initial player cards become two starting hands
    ///      - `hand1Extra` are the extra cards for the first hand (starting from initial3[0].cardId)
    ///      - `hand2Extra` are the extra cards for the second hand (starting from initial3[1].cardId)
    ///      - blackjack after split is treated as 21 (no 3:2 bonus)
    ///      - `doubled` must be false (no DAS in this version)
    function settle(
        uint256 roundId,
        uint8 holeCardId, bytes32 holeSalt, bytes32[] calldata holeProof,
        Reveal[] calldata initial3,            // [player1, player2, dealerUp]
        Reveal[] calldata playerExtra,         // single-hand extras (ignored if split=true)
        Reveal[] calldata dealerDraws,         // all dealer draws (after hole)
        bool doubled,
        bool split,
        Reveal[] calldata hand1Extra,          // used only if split=true
        Reveal[] calldata hand2Extra           // used only if split=true
    ) external {
        Round storage rd = R[roundId];
        require(rd.player == msg.sender, "PLAYER");
        require(!rd.settled, "SETTLED");
        require(initial3.length == 3, "INIT3");
        if (split) { require(!doubled, "NO_DAS"); } // disallow double-after-split for this version

        // -- verify hole (scoped so locals die early)
        {
            bytes32 holeLeafCalc = keccak256(abi.encodePacked(holeCardId, holeSalt));
            require(holeLeafCalc == rd.holeLeaf, "HOLELEAF");
            _verifyLeaf(rd.deckRoot, rd.holePos, holeCardId, holeSalt, holeProof);
        }

        // -- verify order & compute incrementally
        uint8 nextPos = 0;

        // P1
        _consume(rd, initial3[0], nextPos);
        Run memory P1 = _add(Run(0,0,0), initial3[0].cardId);
        nextPos = _advance(nextPos, rd.holePos);

        // P2
        _consume(rd, initial3[1], nextPos);
        Run memory P2 = _add(Run(0,0,0), initial3[1].cardId);
        nextPos = _advance(nextPos, rd.holePos);

        // Dealer up
        _consume(rd, initial3[2], nextPos);
        uint8 dealerUpId = initial3[2].cardId;
        nextPos = _advance(nextPos, rd.holePos);

        // Player plays
        bool usedSplit = split;
        if (usedSplit) {
            // Hand #1 extras
            for (uint i = 0; i < hand1Extra.length; i++) {
                _consume(rd, hand1Extra[i], nextPos);
                P1 = _add(P1, hand1Extra[i].cardId);
                nextPos = _advance(nextPos, rd.holePos);
            }
            // Hand #2 extras
            for (uint j = 0; j < hand2Extra.length; j++) {
                _consume(rd, hand2Extra[j], nextPos);
                P2 = _add(P2, hand2Extra[j].cardId);
                nextPos = _advance(nextPos, rd.holePos);
            }
        } else {
            P1 = _add(P1, initial3[1].cardId);
            // Single-hand extras go onto P1; P2 is just the second initial card (kept for event packaging)
            for (uint k = 0; k < playerExtra.length; k++) {
                _consume(rd, playerExtra[k], nextPos);
                P1 = _add(P1, playerExtra[k].cardId);
                nextPos = _advance(nextPos, rd.holePos);
            }
        }

        // -- Dealer S17 (inline)
        Run memory D = _add(_add(Run(0,0,0), dealerUpId), holeCardId);
        uint need = 0;
        while (D.total < 17) { // S17 stands on ALL 17
            require(need < dealerDraws.length, "NEED_CARD");
            _consume(rd, dealerDraws[need], nextPos);      // verify pos/proof
            D = _add(D, dealerDraws[need].cardId);         // update total
            nextPos = _advance(nextPos, rd.holePos);       // advance deck index (skip hole)
            need++;
            if (D.total > 21) break;                       // bust
        }
        require(need == dealerDraws.length, "EXTRA_CARD");

        // -- stake & payout
        uint128 base = rd.stakeWei;
        uint128 payout;

        if (usedSplit) {
            // Blackjack after split counts as 21 (no BJ bonus).
            uint128 p1 = _payout(P1.total, false, D.total, base);
            uint128 p2 = _payout(P2.total, false, D.total, base);
            payout = p1 + p2;
        } else {
            bool pBJ = (P1.count == 2 && P1.total == 21); // initial two-card blackjack only in non-split path
            uint128 stake = base;
            if (doubled) { stake = uint128(uint256(stake) * 2); }
            payout = _payout(P1.total, pBJ, D.total, stake);
        }

        // -- credit via vault & finalize
        if (payout > 0) {
            vault.scoopFromPool(rd.player, payout);
        }
        rd.settled = true;

        // Emit compact summary (arrays rebuilt only for readability)
        uint ph1 = usedSplit ? hand1Extra.length : playerExtra.length;
        uint ph2 = usedSplit ? hand2Extra.length : 0;
        uint totalLen = 2 + ph1 + ph2;
        uint8[] memory pAll = new uint8[](totalLen);
        pAll[0] = initial3[0].cardId;
        pAll[1] = initial3[1].cardId;
        for (uint i1 = 0; i1 < ph1; i1++) {
            pAll[2 + i1] = usedSplit ? hand1Extra[i1].cardId : playerExtra[i1].cardId;
        }
        for (uint i2 = 0; i2 < ph2; i2++) {
            pAll[2 + ph1 + i2] = hand2Extra[i2].cardId;
        }

        uint dl = dealerDraws.length;
        uint8[] memory dIds = new uint8[](dl);
        for (uint k2 = 0; k2 < dl; k2++) { dIds[k2] = dealerDraws[k2].cardId; }

        emit RoundSettled(roundId, rd.player, rd.stakeWei, payout, pAll, dealerUpId, holeCardId, dIds);
    }

    // ---------- Internals ----------
    function _advance(uint8 pos, uint8 holePos) private pure returns (uint8) {
        unchecked { pos++; }
        if (pos == holePos) { unchecked { pos++; } }
        return pos;
    }

    function _consume(Round storage rd, Reveal calldata rv, uint8 expectedPos) private view {
        require(rv.pos == expectedPos, "POS");
        require(rv.pos != rd.holePos, "HOLEPOS");
        _verifyLeaf(rd.deckRoot, rv.pos, rv.cardId, rv.salt, rv.proof);
    }

    function _verifyLeaf(
        bytes32 root,
        uint8 pos,
        uint8 cardId,
        bytes32 salt,
        bytes32[] calldata proof
    ) private pure {
        bytes32 h = keccak256(abi.encodePacked(cardId, salt)); // leaf
        uint idx = pos;
        bytes32 computed = h;
        for (uint i = 0; i < proof.length; i++) {
            bytes32 sib = proof[i];
            if (idx % 2 == 0) {
                computed = keccak256(abi.encodePacked(computed, sib));
            } else {
                computed = keccak256(abi.encodePacked(sib, computed));
            }
            idx >>= 1;
        }
        require(computed == root, "PROOF");
    }

    /// @dev Payout in wei to credit to player (includes principal).
    ///      Standard: loss -> 0, push -> stake, win -> 2*stake, blackjack -> 5*stake/2.
    ///      Note: BJ bonus is only applied to initial two-card 21 in a non-split hand.
    function _payout(uint8 pTot, bool pBJ, uint8 dTot, uint128 stake) private pure returns (uint128) {
        if (pBJ) {
            // Dealer blackjack (21) → push; else BJ pays 3:2
            return (dTot == 21) ? stake : uint128(uint256(stake) * 5 / 2);
        }
        if (pTot > 21) return 0;           // player bust
        if (dTot > 21) return stake * 2;   // dealer bust
        if (pTot == dTot) return stake;    // push
        return (pTot > dTot) ? stake * 2 : 0;
    }

    
    function cardName(uint8 id) external pure returns (string memory) {
        string[13] memory RANKS_ = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
        string[4]  memory SUITS_ = [unicode"♣", unicode"♦", unicode"♥", unicode"♠"];
        return string(abi.encodePacked(RANKS_[id % 13], SUITS_[id / 13]));
    }
}

