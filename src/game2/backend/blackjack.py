import json, os, secrets, argparse
from typing import List, Dict, Any, Tuple, Optional
from decimal import Decimal
from dotenv import load_dotenv
from web3 import Web3

# --- NEW: Flask Imports ---
from flask import Flask, jsonify, request
from flask_cors import CORS
# --- End Flask Imports ---

NETWORK = os.getenv("NETWORK", "localhost") 

if NETWORK == "sepolia":
    RPC_URL = os.getenv("SEPOLIA_RPC_URL")
    VAULT_ADDRESS = "0x7DF90fdCA5177597c968E672E5206543FceaD7DC"
    BLACKJACK_ADDRESS = "0xD8f1a1e614E0Cb0CDc9804800d224E8ecE2b8ddB"
    CHAIN_ID = 11155111
    PRIVATE_KEY = os.getenv("PRIVATE_KEY")  # Sepolia key
else:
    RPC_URL = "http://127.0.0.1:8545"
    VAULT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    BLACKJACK_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    CHAIN_ID = 31337
    PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"  # Hardha 0


load_dotenv()

try:
    from eth_hash.auto import keccak
except Exception:
    import sha3
    def keccak(x: bytes) -> bytes:
        k = sha3.keccak_256()
        k.update(x)
        return k.digest()

def inject_poa(w3: Web3):
    # (Omitted for brevity - same as your file)
    try:
        from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    except Exception:
        try:
            from web3.middleware import geth_poa_middleware
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        except Exception:
            pass

# --- Card helpers (Omitted for brevity - same as your file) ---
RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"]
SUITS = ["♣","♦","♥","♠"]

def card_name(cid:int)->str:
    return f"{RANKS[cid%13]}{SUITS[cid//13]}"
def card_value(cid:int)->int:
    r = cid % 13
    if r == 0: return 11
    if r <= 9: return r + 1
    return 10
def hand_total(cards: List[int]) -> Tuple[int,bool,bool]:
    t = 0; aces = 0
    for c in cards:
        v = card_value(c)
        t += v
        if c % 13 == 0: aces += 1
    while t > 21 and aces > 0:
        t -= 10; aces -= 1
    blackjack = (len(cards) == 2 and t == 21)
    soft = (aces > 0 and t <= 21)
    return t, soft, blackjack
def same_numeric_value(c1:int, c2:int)->bool:
    """Return True if cards are splittable by numeric value.
       We treat 10/J/Q/K as the same numeric value (10)."""
    r1, r2 = c1 % 13, c2 % 13
    v1 = 10 if r1 >= 10 else (11 if r1 == 0 else r1 + 1)
    v2 = 10 if r2 >= 10 else (11 if r2 == 0 else r2 + 1)
    return v1 == v2
# --- End Card helpers ---


# --- Merkle helpers (Omitted for brevity - same as your file) ---
def leaf_of(card_id:int, salt:bytes)->bytes:
    return keccak(bytes([card_id]) + salt)
def build_tree(leaves: List[bytes]) -> List[List[bytes]]:
    # (Omitted for brevity - same as your file)
    layers = [leaves]
    while len(layers[-1]) > 1:
        prev = layers[-1]
        nxt = []
        for i in range(0, len(prev), 2):
            L = prev[i]
            R = prev[i+1] if i+1 < len(prev) else prev[i]
            nxt.append(keccak(L + R))
        layers.append(nxt)
    return layers
def build_proof(layers: List[List[bytes]], index:int) -> List[bytes]:
    # (Omitted for brevity - same as your file)
    proof = []
    idx = index
    for level in range(len(layers)-1):
        arr = layers[level]
        is_right = (idx % 2) == 1
        sib_idx = idx-1 if is_right else idx+1
        sibling = arr[sib_idx] if sib_idx < len(arr) else arr[idx]
        proof.append(sibling)
        idx //= 2
    return proof
def hex0(x:bytes)->str: return "0x"+x.hex()
# --- End Merkle helpers ---


# --- Deck generator (Omitted for brevity - same as your file) ---
def make_deck(hole_pos:int=7, seed: Optional[int]=None) -> Dict[str,Any]:
    cards = list(range(52))
    if seed is not None:
        rng = secrets.SystemRandom(seed)
    else:
        rng = secrets.SystemRandom()
    for i in range(51,0,-1):
        j = rng.randrange(0, i+1)
        cards[i], cards[j] = cards[j], cards[i]
    salts = [secrets.token_bytes(32) for _ in range(52)]
    leaves = [leaf_of(cards[i], salts[i]) for i in range(52)]
    layers = build_tree(leaves)
    root = layers[-1][0]
    hole_leaf = leaves[hole_pos]
    data = {
        "deckRoot": hex0(root),
        "holePos": hole_pos,
        "holeLeaf": hex0(hole_leaf),
        "holeCardId": cards[hole_pos],
        "holeSalt": hex0(salts[hole_pos]),
        "holeProof": [hex0(x) for x in build_proof(layers, hole_pos)],
        "reveals": [
            {
                "pos": i,
                "cardId": cards[i],
                "salt": hex0(salts[i]),
                "proof": [hex0(x) for x in build_proof(layers, i)]
            }
            for i in range(52) if i != hole_pos
        ]
    }
    return data
# --- End Deck generator ---


# --- Web3 glue (Omitted for brevity - ABI/helpers same as your file) ---
ABI = json.loads(r"""
[
  {
    "inputs":[
      {"internalType":"bytes32","name":"deckRoot","type":"bytes32"},
      {"internalType":"uint8","name":"holePos","type":"uint8"},
      {"internalType":"bytes32","name":"holeLeaf","type":"bytes32"},
      {"internalType":"uint128","name":"stakeWei","type":"uint128"}
    ],
    "name":"startRound",
    "outputs":[{"internalType":"uint256","name":"roundId","type":"uint256"}],
    "stateMutability":"nonpayable",
    "type":"function"
  },
  {
    "inputs":[
      {"internalType":"uint256","name":"roundId","type":"uint256"},
      {"internalType":"uint8","name":"holeCardId","type":"uint8"},
      {"internalType":"bytes32","name":"holeSalt","type":"bytes32"},
      {"internalType":"bytes32[]","name":"holeProof","type":"bytes32[]"},
      {"components":[
        {"internalType":"uint8","name":"pos","type":"uint8"},
        {"internalType":"uint8","name":"cardId","type":"uint8"},
        {"internalType":"bytes32","name":"salt","type":"bytes32"},
        {"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}
      ],"internalType":"struct BlackjackSettlement.Reveal[]","name":"initial3","type":"tuple[]"},
      {"components":[
        {"internalType":"uint8","name":"pos","type":"uint8"},
        {"internalType":"uint8","name":"cardId","type":"uint8"},
        {"internalType":"bytes32","name":"salt","type":"bytes32"},
        {"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}
      ],"internalType":"struct BlackjackSettlement.Reveal[]","name":"playerExtra","type":"tuple[]"},
      {"components":[
        {"internalType":"uint8","name":"pos","type":"uint8"},
        {"internalType":"uint8","name":"cardId","type":"uint8"},
        {"internalType":"bytes32","name":"salt","type":"bytes32"},
        {"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}
      ],"internalType":"struct BlackjackSettlement.Reveal[]","name":"dealerDraws","type":"tuple[]"},
      {"internalType":"bool","name":"doubled","type":"bool"},
      {"internalType":"bool","name":"split","type":"bool"},
      {"components":[
        {"internalType":"uint8","name":"pos","type":"uint8"},
        {"internalType":"uint8","name":"cardId","type":"uint8"},
        {"internalType":"bytes32","name":"salt","type":"bytes32"},
        {"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}
      ],"internalType":"struct BlackjackSettlement.Reveal[]","name":"hand1Extra","type":"tuple[]"},
      {"components":[
        {"internalType":"uint8","name":"pos","type":"uint8"},
        {"internalType":"uint8","name":"cardId","type":"uint8"},
        {"internalType":"bytes32","name":"salt","type":"bytes32"},
        {"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}
      ],"internalType":"struct BlackjackSettlement.Reveal[]","name":"hand2Extra","type":"tuple[]"}
    ],
    "name":"settle",
    "outputs":[],
    "stateMutability":"nonpayable",
    "type":"function"
  },
  {
    "anonymous":false,
    "inputs":[
      {"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},
      {"indexed":true,"internalType":"address","name":"player","type":"address"},
      {"indexed":false,"internalType":"uint128","name":"stakeWei","type":"uint128"},
      {"indexed":false,"internalType":"bytes32","name":"deckRoot","type":"bytes32"},
      {"indexed":false,"internalType":"uint8","name":"holePos","type":"uint8"},
      {"indexed":false,"internalType":"bytes32","name":"holeLeaf","type":"bytes32"}
    ],
    "name":"RoundStarted",
    "type":"event"
  },
  {
    "anonymous":false,
    "inputs":[
      {"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},
      {"indexed":true,"internalType":"address","name":"player","type":"address"},
      {"indexed":false,"internalType":"uint128","name":"stakeWei","type":"uint128"},
      {"indexed":false,"internalType":"uint128","name":"payoutWei","type":"uint128"},
      {"indexed":false,"internalType":"uint8[]","name":"playerCards","type":"uint8[]"},
      {"indexed":false,"internalType":"uint8","name":"dealerUp","type":"uint8"},
      {"indexed":false,"internalType":"uint8","name":"dealerHole","type":"uint8"},
      {"indexed":false,"internalType":"uint8[]","name":"dealerDraws","type":"uint8[]"}
    ],
    "name":"RoundSettled",
    "type":"event"
  }
]
""")

def to_bytes32(hexstr: str) -> str:
    # (Omitted for brevity - same as your file)
    if not isinstance(hexstr, str) or not hexstr.startswith("0x"):
        raise ValueError("hex must start with 0x")
    if len(hexstr) != 66:
        raise ValueError(f"not 32-byte hex: {hexstr}")
    return hexstr
def reveals_for_web3(rev_list: List[Dict[str,Any]]) -> List[Dict[str,Any]]:
    # (Omitted for brevity - same as your file)
    out = []
    for r in rev_list:
        out.append({
            "pos": int(r["pos"]),
            "cardId": int(r["cardId"]),
            "salt": to_bytes32(r["salt"]),
            "proof": [to_bytes32(x) for x in r["proof"]]
        })
    return out
def mk_w3(rpc: str) -> Web3:
    # (Omitted for brevity - same as your file)
    w3 = Web3(Web3.HTTPProvider(rpc))
    try:
        inject_poa(w3)
    except Exception:
        pass
    return w3
def _send_and_wait(w3, acct, tx_dict):
    # (Omitted for brevity - same as your file)
    signed = acct.sign_transaction(tx_dict)
    raw = getattr(signed, "rawTransaction", None) or getattr(signed, "raw_transaction", None)
    if raw is None:
        raise RuntimeError("web3 SignedTransaction missing raw{_}transaction")
    txh = w3.eth.send_raw_transaction(raw)
    return w3.eth.wait_for_transaction_receipt(txh)

def start_round_web3(w3: Web3, contract, acct, deck, stake_wei: int) -> int:
    tx = contract.functions.startRound(
        to_bytes32(deck["deckRoot"]),
        int(deck["holePos"]),
        to_bytes32(deck["holeLeaf"]),
        int(stake_wei)
    ).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 600_000,
        # NOTE: Using Hardhat's default gas price logic is better
        # "gasPrice": w3.to_wei(1, "gwei"),
    })

    rcpt = _send_and_wait(w3, acct, tx)

    try:
        evts = contract.events.RoundStarted().process_receipt(rcpt)
        if evts and len(evts) > 0:
            return int(evts[0]["args"]["roundId"])
    except Exception as e:
        print(f"Warning: Could not decode RoundStarted event: {e}")
        pass
    
    # This is a critical failure if we can't get the roundId
    raise RuntimeError("Could not infer roundId from events.")

def settle_web3(w3: Web3, contract, acct, round_id: int, sim, doubled: bool=False):
    # (Omitted for brevity - same as your file)
    split = bool(sim.get("split", False))
    hand1 = sim.get("hand1Extra", [])
    hand2 = sim.get("hand2Extra", [])
    playerExtra = sim.get("playerExtra", [])
    tx = contract.functions.settle(
        int(round_id),
        int(sim["holeCardId"]),
        to_bytes32(sim["holeSalt"]),
        [to_bytes32(x) for x in sim["holeProof"]],
        reveals_for_web3(sim["initial3"]),
        reveals_for_web3(playerExtra),
        reveals_for_web3(sim["dealerDraws"]),
        bool(doubled if not split else False),
        split,
        reveals_for_web3(hand1),
        reveals_for_web3(hand2)
    ).build_transaction({
        "from": acct.address,
        "nonce": w3.eth.get_transaction_count(acct.address),
        "gas": 1_800_000,
    })
    rcpt = _send_and_wait(w3, acct, tx)
    payout = None
    try:
        logs = contract.events.RoundSettled().process_receipt(rcpt)
        if logs and len(logs) > 0:
            payout = int(logs[0]["args"]["payoutWei"])
    except Exception:
        pass
    return rcpt, payout
# --- End Web3 glue ---

# ==================================================================
# --- FLASK API SERVER ---
# ==================================================================

# --- Global Server State ---
active_games: Dict[int, Dict[str, Any]] = {}

# --- Flask App Setup ---
app = Flask(__name__)

# 基础CORS（保留）
CORS(app)

# 手动添加CORS头（确保生效）
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Max-Age'] = '3600'
    return response

# 添加OPTIONS路由处理器
@app.route('/api/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = app.make_response(('', 204))
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

# ==================================================================
# --- NETWORK CONFIGURATION ---
# ==================================================================

import json
from pathlib import Path

def load_deployment_addresses(network: str):
    address_file = Path(f"addresses.{network}.json")
    if address_file.exists():
        with open(address_file, 'r') as f:
            data = json.load(f)
            return data.get("contracts", {})
    return None

NETWORK = os.getenv("NETWORK", "localhost").lower()
deployed_contracts = load_deployment_addresses(NETWORK)

NETWORK_CONFIGS = {
    "localhost": {
        "rpc_url": "http://127.0.0.1:8545",
        "chain_id": 31337,
        "blackjack_address": (
            deployed_contracts.get("BlackjackSettlement") if deployed_contracts 
            else os.getenv("LOCALHOST_BLACKJACK_ADDRESS")
        ),
        "vault_address": (
            deployed_contracts.get("UserVaultSystem") if deployed_contracts
            else os.getenv("LOCALHOST_VAULT_ADDRESS")
        ),
        "private_key": os.getenv("PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"),
        "name": "Localhost",
        "explorer": ""
    },
    "sepolia": {
        "rpc_url": os.getenv("SEPOLIA_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"),
        "chain_id": 11155111,
        "blackjack_address": (
            deployed_contracts.get("BlackjackSettlement") if deployed_contracts
            else os.getenv("SEPOLIA_BLACKJACK_ADDRESS")
        ),
        "vault_address": (
            deployed_contracts.get("UserVaultSystem") if deployed_contracts
            else os.getenv("SEPOLIA_VAULT_ADDRESS")
        ),
        "private_key": os.getenv("PRIVATE_KEY"),
        "name": "Sepolia Testnet",
        "explorer": "https://sepolia.etherscan.io"
    },
    "goerli": {
        "rpc_url": os.getenv("GOERLI_RPC_URL", ""),
        "chain_id": 5,
        "blackjack_address": (
            deployed_contracts.get("BlackjackSettlement") if deployed_contracts
            else os.getenv("GOERLI_BLACKJACK_ADDRESS")
        ),
        "vault_address": (
            deployed_contracts.get("UserVaultSystem") if deployed_contracts
            else os.getenv("GOERLI_VAULT_ADDRESS")
        ),
        "private_key": os.getenv("PRIVATE_KEY"),
        "name": "Goerli Testnet",
        "explorer": "https://goerli.etherscan.io"
    }
}

if NETWORK not in NETWORK_CONFIGS:
    print(f"Error: Unknown network '{NETWORK}'")
    print(f"Available networks: {', '.join(NETWORK_CONFIGS.keys())}")
    print("Set NETWORK environment variable to one of the above")
    import sys
    sys.exit(1)


network_config = NETWORK_CONFIGS[NETWORK]

RPC_URL = network_config["rpc_url"]
CHAIN_ID = network_config["chain_id"]
BLACKJACK_ADDR = network_config["blackjack_address"]
VAULT_ADDR = network_config["vault_address"]
PRIVATE_KEY = network_config["private_key"]
NETWORK_NAME = network_config["name"]
EXPLORER_URL = network_config["explorer"]

if not PRIVATE_KEY:
    print(f"Error: PRIVATE_KEY not set for {NETWORK} network")
    print("Please set PRIVATE_KEY in your .env file")
    import sys
    sys.exit(1)

if not BLACKJACK_ADDR or not VAULT_ADDR:
    print(f"Error: Contract addresses not set for {NETWORK} network")
    print(f"\nPossible causes:")
    print(f"  1. Contracts not deployed yet")
    print(f"  2. addresses.{NETWORK}.json file not found")
    print(f"  3. Environment variables not set")
    print(f"\nTo fix:")
    print(f"  1. Deploy contracts:")
    print(f"     npx hardhat run scripts/deploy_all.js --network {NETWORK}")
    print(f"  2. Or set environment variables in .env:")
    print(f"     {NETWORK.upper()}_BLACKJACK_ADDRESS=0x...")
    print(f"     {NETWORK.upper()}_VAULT_ADDRESS=0x...")
    import sys
    sys.exit(1)

print("\n" + "="*60)
print(f"Backend Configuration - {NETWORK_NAME}")
print("="*60)
print(f"Network: {NETWORK}")
print(f"Chain ID: {CHAIN_ID}")
print(f"RPC URL: {RPC_URL}")
print(f"Vault Address: {VAULT_ADDR}")
print(f"Blackjack Address: {BLACKJACK_ADDR}")
if deployed_contracts:
    print(f"Config Source: addresses.{NETWORK}.json")
else:
    print(f"Config Source: Environment variables")
if EXPLORER_URL:
    print(f"Explorer: {EXPLORER_URL}")
print(f"Private Key: {PRIVATE_KEY[:10]}...{PRIVATE_KEY[-4:]}")
print("="*60 + "\n")

# --- Web3 Setup ---
print("Initializing Web3 connection...")
w3 = mk_w3(RPC_URL)


try:
    block_number = w3.eth.block_number
    print(f"Connected successfully! Current block: {block_number}\n")
except Exception as e:
    print(f"Error: Failed to connect to RPC endpoint")
    print(f"  {str(e)}")
    print(f"\nPlease check:")
    print(f"  1. RPC URL is correct: {RPC_URL}")
    print(f"  2. Network is accessible")
    if NETWORK != "localhost":
        print(f"  3. API key (if using Alchemy/Infura) is valid")
    else:
        print(f"  3. Hardhat node is running: npx hardhat node")
    import sys
    sys.exit(1)

active_games_by_player: Dict[str, Dict[str, Any]] = {}
completed_games_by_player: Dict[str, Dict[str, Any]] = {}

print(f"Backend server running in 'Frontend-Managed' mode on {NETWORK_NAME}")
print("Server will generate decks, frontend will call contracts.\n")

active_games_by_player: Dict[str, Dict[str, Any]] = {}
completed_games_by_player: Dict[str, Dict[str, Any]] = {}
print("Backend server running in 'Frontend-Managed' mode.")
print("Server will generate decks, frontend will call contracts.")


@app.route("/api/start-game", methods=["POST"])
def api_start_game():
    """
    Called by React when user clicks 'Start Game'.
    This API generates the deck, saves it, and returns
    the data needed for the frontend to call the contract.
    """
    data = request.json
    player_address = data.get("playerAddress")
    if not player_address:
        return jsonify({"error": "playerAddress is required"}), 400
    
    player_address_checksum = Web3.to_checksum_address(player_address)

    # (新增) 清理上一局可能未被领取的“完整证据”
    if player_address_checksum in completed_games_by_player:
        print(f"Warning: Clearing old, un-fetched proof for {player_address_checksum}")
        try:
            del completed_games_by_player[player_address_checksum]
        except KeyError:
            pass
        
    # [NEW] Clear any old game state for this player
    if player_address_checksum in active_games_by_player:
        print(f"Warning: Clearing old game state for {player_address_checksum}")
        del active_games_by_player[player_address_checksum]

    print(f"Received /api/start-game request from {player_address_checksum}")

    # 1. Generate a new deck
    deck = make_deck()
    
    # 2. Get initial 3 cards for the UI
    # We must use an iterator to "consume" the deck
    reveals_iter = iter(deck["reveals"])
    r0 = next(reveals_iter) # Player 1
    r1 = next(reveals_iter) # Player 2
    r2 = next(reveals_iter) # Dealer Up

    initial_hand = {
        "playerCard1": r0["cardId"],
        "playerCard2": r1["cardId"],
        "dealerUpCard": r2["cardId"]
    }

    # 3. Store the *rest* of the deck and state on the server
    # (新增) 检查是否可分牌
    p1_card_id = r0["cardId"]
    p2_card_id = r1["cardId"]
    is_splittable = same_numeric_value(p1_card_id, p2_card_id)
    
    active_games_by_player[player_address_checksum] = {
        "deck": deck,
        "reveals_iter": reveals_iter,
        "initial_reveals": [r0, r1, r2],

        "is_split": False,
        "is_doubled": False,

        # 用于非分牌路径
        "player_cards": [p1_card_id, p2_card_id],
        "player_extra_reveals": [],

        # --- (新增) 用于分牌路径 ---
        "hand1_cards": [], 
        "hand2_cards": [], 
        "hand1_extra_reveals": [],
        "hand2_extra_reveals": [],
        # 0=主手牌, 1=分牌后手牌1, 2=分牌后手牌2
        "current_hand_being_played": 0,
        "dealer_cards": [r2["cardId"]],  # <--- 新增：初始化庄家手牌 (r2 是亮牌)
        "dealer_draw_reveals": []       # <--- 新增：初始化庄家未来的抽牌
    }
    print(f"Deck created and stored for {player_address_checksum}. Splittable: {is_splittable}")

    # 4. Return data needed by frontend
    response_data = {
        # Data for the CONTRACT call (startRound)
        "deckRoot": deck["deckRoot"],
        "holePos": deck["holePos"],
        "holeLeaf": deck["holeLeaf"],

        # Data for the UI
        "initialHand": {
            "playerCard1": p1_card_id,
            "playerCard2": p2_card_id,
            "dealerUpCard": r2["cardId"],
            "isSplittable": is_splittable, # (新增) 告诉前端
        }
    }

    return jsonify(response_data)



@app.route("/api/split", methods=["POST"])
def api_split():
    """
    Called by React when user clicks 'Split'.
    Frontend ALREADY pushed the second stake.
    This API splits the hands, draws 2 new cards (1 for each),
    and returns the two new hands.
    """
    data = request.json
    player_address = data.get("playerAddress")
    if not player_address:
        return jsonify({"error": "playerAddress is required"}), 400
        
    player_address_checksum = Web3.to_checksum_address(player_address)
    
    game = active_games_by_player.get(player_address_checksum)
    if not game:
        return jsonify({"error": "No active game found for this player."}), 404
    
    if game["is_split"]:
         return jsonify({"error": "Game is already split."}), 400

    print(f"Processing /api/split for {player_address_checksum}")

    try:
        # 1. 标记为分牌
        game["is_split"] = True
        game["current_hand_being_played"] = 1 # 开始玩手牌1

        # 2. 获取初始的两张牌
        r0_player1 = game["initial_reveals"][0]
        r1_player2 = game["initial_reveals"][1]
        
       # 3. (修改) 只为手牌1抽一张新牌
        reveals_iter = game["reveals_iter"]
        r_new_for_hand1 = next(reveals_iter)

        # 4. (修改) 存储新的手牌状态
        game["hand1_cards"] = [r0_player1["cardId"], r_new_for_hand1["cardId"]]
        game["hand1_extra_reveals"] = [r_new_for_hand1]

        # (修改) 手牌2暂时只有一张牌
        game["hand2_cards"] = [r1_player2["cardId"]] 
        game["hand2_extra_reveals"] = [] # 保持为空

        # 5. 清理
        game["player_cards"] = []
        game["player_extra_reveals"] = []
        
        print(f"  > Hand 1: {[card_name(c) for c in game['hand1_cards']]}")
        print(f"  > Hand 2: {[card_name(c) for c in game['hand2_cards']]}")

        # 6. (修改) 返回两只手（手牌2只有一张牌）
        return jsonify({ 
            "hand1": game["hand1_cards"],
            "hand2": game["hand2_cards"], # 前端会显示 [cardId]
        })
        
    except StopIteration:
        return jsonify({"error": "Deck is out of cards!"}), 500
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500




@app.route("/api/hit", methods=["POST"])
def api_hit():
    """
    Called by React when user clicks 'Hit'.
    Draws one card from the deck stored on the server.
    If split, 'hand' (1 or 2) must be provided.
    """
    data = request.json
    player_address = data.get("playerAddress")
    hand_to_hit = data.get("hand", 0)
    
    if not player_address:
        return jsonify({"error": "playerAddress is required"}), 400
        
    player_address_checksum = Web3.to_checksum_address(player_address)
    game = active_games_by_player.get(player_address_checksum)
    
    if not game:
        return jsonify({"error": "No active game found for this player. Please start a new game."}), 404
        
    print(f"Processing /api/hit for {player_address_checksum}, hand: {hand_to_hit}")
        
    try:
        reveals_iter = game["reveals_iter"]
        r_new = next(reveals_iter)
        print(f"  > Dealt card: {card_name(r_new['cardId'])}")
        
        if game["is_split"]:
            if hand_to_hit == 1:
                game["hand1_cards"].append(r_new["cardId"])
                game["hand1_extra_reveals"].append(r_new)
                new_hand_cards = game["hand1_cards"]
            elif hand_to_hit == 2:
                game["hand2_cards"].append(r_new["cardId"])
                game["hand2_extra_reveals"].append(r_new)
                new_hand_cards = game["hand2_cards"]
            else:
                return jsonify({"error": "Invalid hand specified for split game."}), 400
        else:
            game["player_cards"].append(r_new["cardId"])
            game["player_extra_reveals"].append(r_new)
            new_hand_cards = game["player_cards"]

        total, soft, blackjack = hand_total(new_hand_cards)
        
        if total > 21:
            print(f"  > Player busted with {total}")
            return jsonify({
                "newCard": r_new,
                "hand": hand_to_hit,
                "newHandCards": new_hand_cards,
                "busted": True,  
                "total": total
            })

        return jsonify({ 
            "newCard": r_new,
            "hand": hand_to_hit, 
            "newHandCards": new_hand_cards 
        })
        
    except StopIteration:
        return jsonify({"error": "Deck is out of cards!"}), 500
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/stand", methods=["POST"])
def api_stand():
    """
    Called by React when user clicks 'Stand'.
    If split and on hand 1, just switches to hand 2.
    Otherwise, simulates dealer's turn and returns settlement data.
    """
    data = request.json
    player_address = data.get("playerAddress")
    hand_to_stand = data.get("hand", 0)
    
    if not player_address:
        return jsonify({"error": "playerAddress is required"}), 400
        
    player_address_checksum = Web3.to_checksum_address(player_address)
    game = active_games_by_player.get(player_address_checksum)
    
    if not game:
        return jsonify({"error": "No active game found for this player."}), 404
    
    print(f"Processing /api/stand for {player_address_checksum}, hand: {hand_to_stand}")

    if game["is_split"] and hand_to_stand == 1:
        game["current_hand_being_played"] = 2
        try:
            reveals_iter = game["reveals_iter"]
            r_new_for_hand2 = next(reveals_iter)
            game["hand2_cards"].append(r_new_for_hand2["cardId"])
            game["hand2_extra_reveals"].append(r_new_for_hand2)
            print(f"  > Stood on hand 1. Dealt Hand 2's second card: {card_name(r_new_for_hand2['cardId'])}")
            return jsonify({ 
                "handSwitched": True,
                "activeHand": 2,
                "newHand2Cards": game["hand2_cards"]
            })
        except Exception as e:
            return jsonify({"error": f"Error dealing card for hand 2: {str(e)}"}), 500

    try:
        deck = game["deck"]
        reveals_iter = game["reveals_iter"]
        if "dealer_cards" not in game:
            game["dealer_cards"] = [game["initial_reveals"][2]["cardId"]]
        if "dealer_draw_reveals" not in game:
            game["dealer_draw_reveals"] = []

        hole_card_id = deck["holeCardId"]
        if len(game["dealer_cards"]) == 1:
            game["dealer_cards"].append(hole_card_id)

        dealer_total, _, _ = hand_total(game["dealer_cards"])
        while dealer_total < 17:
            r_draw = next(reveals_iter)
            game["dealer_draw_reveals"].append(r_draw)
            game["dealer_cards"].append(r_draw["cardId"])
            dealer_total, _, _ = hand_total(game["dealer_cards"])
            print(f"  > Dealer draws: {card_name(r_draw['cardId'])}. New total: {dealer_total}")
        print(f"  > Dealer stands with total: {dealer_total}")

        settlement_data = {
            "holeCardId": deck["holeCardId"],
            "holeSalt": deck["holeSalt"],
            "holeProof": deck["holeProof"],
            "initial3": game["initial_reveals"],
            "dealerDraws": game["dealer_draw_reveals"],
            "split": game["is_split"],
            "doubled": game.get("doubled", False),
            "playerExtra": game.get("player_extra_reveals", []),
            "hand1Extra": game.get("hand1_extra_reveals", []),
            "hand2Extra": game.get("hand2_extra_reveals", [])
        }
        
        response = {
            "settlementData": settlement_data,
            "dealerFullHand": game["dealer_cards"]
        }
        
        completed_games_by_player[player_address_checksum] = game["deck"]
        del active_games_by_player[player_address_checksum]
        print(f"Game for {player_address_checksum} finished. Moved to 'completed' for proof reveal.")
        return jsonify(response)
        
    except StopIteration:
        return jsonify({"error": "Deck is out of cards!"}), 500
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route("/api/double", methods=["POST"])
def api_double():
    """
    Called by React when user clicks 'Double'.
    Doubles the stake (handled by frontend pushToPool),
    draws exactly ONE card, then stands.
    """
    data = request.json
    player_address = data.get("playerAddress")
    if not player_address:
        return jsonify({"error": "playerAddress is required"}), 400
        
    player_address_checksum = Web3.to_checksum_address(player_address)
    
    game = active_games_by_player.get(player_address_checksum)
    if not game:
        return jsonify({"error": "No active game found for this player."}), 404
        
    print(f"Processing /api/double for {player_address_checksum}")
    
    try:
        deck = game["deck"]
        reveals_iter = game["reveals_iter"]
        
        # 1. Mark as doubled
        game["is_doubled"] = True
        
        # 2. Draw ONE card for the player (like api_hit)
        r_new = next(reveals_iter)
        game["player_extra_reveals"].append(r_new)
        game["player_cards"].append(r_new["cardId"])
        player_final_cards = game["player_cards"] # Get the final list
        
        print(f"  > Player doubles, draws: {card_name(r_new['cardId'])}")
        
        # 3. Simulate Dealer's Turn (S17) - (Copied from api_stand)
        hole_card_id = deck["holeCardId"]
        game["dealer_cards"].append(hole_card_id)
        
        dealer_total, _, _ = hand_total(game["dealer_cards"])
        print(f"  > Dealer's hole card: {card_name(hole_card_id)}. Total: {dealer_total}")

        # Draw cards until 17 or bust (S17 rule)
        while dealer_total < 17:
            r_draw = next(reveals_iter)
            game["dealer_draw_reveals"].append(r_draw)
            game["dealer_cards"].append(r_draw["cardId"])
            
            dealer_total, _, _ = hand_total(game["dealer_cards"])
            print(f"  > Dealer draws: {card_name(r_draw['cardId'])}. New total: {dealer_total}")
            
        print(f"  > Dealer stands with total: {dealer_total}")

        # 4. Package all data for the `settle` function
        settlement_data = {
            "holeCardId": deck["holeCardId"],
            "holeSalt": deck["holeSalt"],
            "holeProof": deck["holeProof"],
            "initial3": game["initial_reveals"],
            "playerExtra": game["player_extra_reveals"], # Contains the single doubled card
            "dealerDraws": game["dealer_draw_reveals"],
            "doubled": True,  # <-- SET TO TRUE
            "split": False,
            "hand1Extra": [],
            "hand2Extra": []
        }
        
        # 5. Return data (frontend needs settlementData, dealerFullHand, AND playerFinalCards)
        response = {
            "settlementData": settlement_data,
            "dealerFullHand": game["dealer_cards"],
            "playerFinalCards": player_final_cards 
        }
        
        # 6. Clean up (Copied from api_stand)
        completed_games_by_player[player_address_checksum] = game["deck"]
        del active_games_by_player[player_address_checksum]
        print(f"Game for {player_address_checksum} finished (Double). Moved to 'completed'.")
        
        return jsonify(response)
        
    except StopIteration:
        return jsonify({"error": "Deck is out of cards!"}), 500
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/get-full-deck-reveal", methods=["POST"])
def api_get_full_deck_reveal():
    """
    Called by React *after* settlement.
    Returns the full deck data for the *last completed game*
    so the user can verify the deckRoot.
    """
    data = request.json
    player_address = data.get("playerAddress")
    if not player_address:
        return jsonify({"error": "playerAddress is required"}), 400

    player_address_checksum = Web3.to_checksum_address(player_address)

    # search in completed games
    completed_deck = completed_games_by_player.get(player_address_checksum)

    if not completed_deck:
        return jsonify({"error": "No completed game proof found for this player. (It may have already been fetched)."}), 404

    print(f"Processing /api/get-full-deck-reveal for {player_address_checksum}")

    # avoid reuse
    try:
        del completed_games_by_player[player_address_checksum]
    except KeyError:
        pass 

    # completed_deck is already in the correct format
    return jsonify(completed_deck)


# This 'main' block is for running the original CLI tool
def main_cli():
    # (This is your original 'main' function, unchanged)
    # (Omitted for brevity)
    pass


# This starts the Flask server
if __name__ == "__main__":
    import os
    
    # Check if we are running as CLI tool
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 'yes')
    
    print(f"   Starting Flask API server on http://{host}:{port}")
    print(f"   Debug mode: {debug}")
    print(f"   Press Ctrl+C to stop\n")
    
    app.run(host=host, port=port, debug=debug)