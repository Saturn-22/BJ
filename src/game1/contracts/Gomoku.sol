pragma solidity >=0.7.0 <0.9.0;

import "./IUserVault.sol";

contract Gomoku {
    // UserVaultSystem 合约的接口
    IUserVault public userVault;

    // 合约部署者（用于 Debug 函数权限控制）
    address public owner;

    // 超时常量：每步棋的时间限制
    uint public constant TURN_TIMEOUT = 90 seconds;

    // 游戏状态枚举
    enum GameStatus { Lobby, InProgress, Finished }

    // 单个游戏对局的数据结构
    struct Game {
        uint gameId;
        address[2] players; // players[0] 是创建者 (黑棋), players[1] 是加入者 (白棋)
        address turn; // 当前轮到谁落子
        GameStatus status;
        address winner;
        uint256 stake; // 单边赌注金额 (总赌注为 stake * 2)
        uint8[15][15] board; // 15x15 的棋盘
        uint moveCount; // 总步数，用于判断平局
        uint lastMoveTimestamp; // 上一次落子或游戏开始的时间戳
    }

    // 状态变量
    uint public gameCounter; // 全局游戏ID计数器
    mapping(uint => Game) public games; // 通过 gameId 查找游戏
    mapping(address => uint) public playerCurrentGame; // 查找玩家当前所在的游戏ID

    // 事件
    event GameCreated(uint indexed gameId, address indexed player1, uint256 stake);
    event GameStarted(uint indexed gameId, address indexed player1, address indexed player2);
    event MoveMade(uint indexed gameId, address indexed player, uint x, uint y);
    event GameEnded(uint indexed gameId, address indexed winner, address loser);
    event GameDrawn(uint indexed gameId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(address _userVaultAddress) {
        userVault = IUserVault(_userVaultAddress);
        owner = msg.sender;
    }

    function createGame(uint256 _stake) external {
        require(_stake > 0, "Stake must be greater than 0");
        require(playerCurrentGame[msg.sender] == 0, "Player is already in a game");
        // 注意：用户需要先调用 UserVaultSystem.pushToPool(_stake) 将资金存入公共池
        userVault.pushToPool(msg.sender,_stake);

        gameCounter++;
        uint newGameId = gameCounter;

        Game storage newGame = games[newGameId];
        newGame.gameId = newGameId;
        newGame.players[0] = msg.sender;
        newGame.stake = _stake;
        newGame.status = GameStatus.Lobby;

        playerCurrentGame[msg.sender] = newGameId;

        emit GameCreated(newGameId, msg.sender, _stake);
    }

    function joinGame(uint _gameId) external {
        Game storage game = games[_gameId];
        require(game.gameId != 0, "Game does not exist");
        require(game.status == GameStatus.Lobby, "Game is not in Lobby state");
        require(msg.sender != game.players[0], "Cannot join your own game");
        require(playerCurrentGame[msg.sender] == 0, "Player is already in a game");
        // 注意：用户需要先调用 UserVaultSystem.pushToPool(game.stake) 将资金存入公共池
        userVault.pushToPool(msg.sender,game.stake);

        // 健壮性检查：确保公共池有足够资金用于本局结算
        uint256 requiredPoolBalance = game.stake * 2;
        require(
            userVault.gamePoolBalance() >= requiredPoolBalance,
            "Insufficient pool balance for this game"
        );

        game.players[1] = msg.sender;
        game.status = GameStatus.InProgress;
        game.turn = game.players[0]; // 黑棋（创建者）先手
        game.lastMoveTimestamp = block.timestamp; // 游戏开始，启动计时器

        playerCurrentGame[msg.sender] = _gameId;

        emit GameStarted(_gameId, game.players[0], msg.sender);
    }

    function makeMove(uint _gameId, uint _x, uint _y) external {
        Game storage game = games[_gameId];
        require(game.status == GameStatus.InProgress, "Game is not in progress");
        require(msg.sender == game.turn, "Not your turn");
        require(_x < 15 && _y < 15, "Invalid coordinates");
        require(game.board[_x][_y] == 0, "Cell is not empty");

        uint8 playerPiece = (msg.sender == game.players[0]) ? 1 : 2;
        game.board[_x][_y] = playerPiece;
        game.moveCount++;
        game.lastMoveTimestamp = block.timestamp; // 每次落子，重置计时器

        emit MoveMade(_gameId, msg.sender, _x, _y);

        if (_checkWin(_gameId, _x, _y)) {
            _endGame(_gameId, msg.sender);
        } else if (game.moveCount == 15 * 15) {
            _endGameDraw(_gameId);
        } else {
            game.turn = (msg.sender == game.players[0]) ? game.players[1] : game.players[0];
        }
    }

    function _checkWin(uint _gameId, uint _x, uint _y) internal view returns (bool) {
        Game storage game = games[_gameId];
        uint8 playerPiece = game.board[_x][_y];

        // Directions: horizontal, vertical, diagonal (down-right), diagonal (up-right)
        int8[2] memory d;

        // horizontal
        d = [int8(0), int8(1)];
        if (checkOneDirection(_gameId, _x, _y, playerPiece, d)) return true;

        // vertical
        d = [int8(1), int8(0)];
        if (checkOneDirection(_gameId, _x, _y, playerPiece, d)) return true;

        // diagonal (down-right)
        d = [int8(1), int8(1)];
        if (checkOneDirection(_gameId, _x, _y, playerPiece, d)) return true;

        // diagonal (up-right)
        d = [int8(1), int8(-1)];
        if (checkOneDirection(_gameId, _x, _y, playerPiece, d)) return true;
        
        return false;
    }

    function checkOneDirection(uint _gameId, uint _x, uint _y, uint8 playerPiece, int8[2] memory direction) internal view returns (bool) {
        Game storage game = games[_gameId];
        uint count = 1;
        // Check in one direction
        for (uint j = 1; j < 5; j++) {
            int nextX = int(_x) + int(direction[0]) * int(j);
            int nextY = int(_y) + int(direction[1]) * int(j);
            if (nextX >= 0 && nextX < 15 && nextY >= 0 && nextY < 15 && game.board[uint(nextX)][uint(nextY)] == playerPiece) {
                count++;
            } else {
                break;
            }
        }
        // Check in the opposite direction
        for (uint j = 1; j < 5; j++) {
            int nextX = int(_x) - int(direction[0]) * int(j);
            int nextY = int(_y) - int(direction[1]) * int(j);
            if (nextX >= 0 && nextX < 15 && nextY >= 0 && nextY < 15 && game.board[uint(nextX)][uint(nextY)] == playerPiece) {
                count++;
            } else {
                break;
            }
        }
        return count >= 5;
    }

    function _endGame(uint _gameId, address _winner) internal {
        Game storage game = games[_gameId];
        require(game.status == GameStatus.InProgress, "Game not in progress");

        address loser = (_winner == game.players[0]) ? game.players[1] : game.players[0];

        // 状态更新（Effects）
        game.status = GameStatus.Finished;
        game.winner = _winner;
        delete playerCurrentGame[game.players[0]];
        delete playerCurrentGame[game.players[1]];

        // 外部交互（Interactions）- 遵循 CEI 模式
        userVault.scoopFromPool(_winner, game.stake * 2);

        emit GameEnded(_gameId, _winner, loser);
    }

    function _endGameDraw(uint _gameId) internal {
        Game storage game = games[_gameId];
        require(game.status == GameStatus.InProgress, "Game not in progress");

        // 状态更新（Effects）
        game.status = GameStatus.Finished;
        delete playerCurrentGame[game.players[0]];
        delete playerCurrentGame[game.players[1]];

        // 外部交互（Interactions）- 遵循 CEI 模式
        userVault.scoopFromPool(game.players[0], game.stake);
        userVault.scoopFromPool(game.players[1], game.stake);

        emit GameDrawn(_gameId);
    }

    function getGameDetails(uint _gameId) external view returns (Game memory) {
        return games[_gameId];
    }

    function getBoard(uint _gameId) external view returns (uint8[15][15] memory) {
        return games[_gameId].board;
    }

    // --- 超时判负 ---
    function claimWinByTimeout(uint _gameId) external {
        Game storage game = games[_gameId];
        require(game.status == GameStatus.InProgress, "Game is not in progress");
        require(block.timestamp > game.lastMoveTimestamp + TURN_TIMEOUT, "Turn timeout not yet reached");
        
        address loser = game.turn;
        address winner = (loser == game.players[0]) ? game.players[1] : game.players[0];
        
        require(msg.sender == winner, "Only the opponent can claim win by timeout");
        
        _endGame(_gameId, winner);
    }

    // --- 认输 ---
    function forfeit(uint _gameId) external {
        Game storage game = games[_gameId];
        require(game.status == GameStatus.InProgress, "Game is not in progress");
        
        address loser = msg.sender;
        require(loser == game.players[0] || loser == game.players[1], "You are not a player in this game");
        
        address winner = (loser == game.players[0]) ? game.players[1] : game.players[0];
        
        _endGame(_gameId, winner);
    }

    // --- 取消游戏（仅在 Lobby 状态下，且仅创建者可调用）---
    function cancelGame(uint _gameId) external {
        Game storage game = games[_gameId];
        require(game.status == GameStatus.Lobby, "Game is not in lobby state");
        require(msg.sender == game.players[0], "Only the creator can cancel the game");

        // 状态更新
        game.status = GameStatus.Finished;
        delete playerCurrentGame[game.players[0]];
        
        // 将创建者已质押的赌注从池中退还
        userVault.scoopFromPool(game.players[0], game.stake);
    }

    // --- Debug 函数（仅用于测试，生产环境应移除或限制权限）---
    function _setMoveCount(uint _gameId, uint _count) external onlyOwner {
        games[_gameId].moveCount = _count;
    }
}
