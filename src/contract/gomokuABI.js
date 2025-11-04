// Minimal ABI for interacting with Gomoku.sol
// Covers creating/joining games, reading state, and playing moves
export const GomokuABI = [
  // write functions
  "function createGame(uint256 _stake) external",
  "function joinGame(uint256 _gameId) external",
  "function makeMove(uint256 _gameId, uint256 _x, uint256 _y) external",

  // read functions
  "function userVault() external view returns (address)",
  "function gameCounter() external view returns (uint256)",
  "function playerCurrentGame(address) external view returns (uint256)",
  // Game struct: (uint gameId, address[2] players, address turn, uint8 status, address winner, uint256 stake, uint8[15][15] board, uint moveCount)
  // Expose via helper getters to avoid decoding full struct when not needed
  "function getGameDetails(uint256 _gameId) external view returns (uint256 gameId, address[2] players, address turn, uint8 status, address winner, uint256 stake, uint8[15][15] board, uint256 moveCount)",
  "function getBoard(uint256 _gameId) external view returns (uint8[15][15] memory)",
];

export default GomokuABI;
