export const UserVaultABI = [
  "function registerUser(string calldata username, string calldata password) external",
  "function login(string calldata password) external",
  "function logout() external",
  "function checkLoginStatus() external view returns (bool)",
  "function changePassword(string calldata oldPassword, string calldata newPassword) external",
  "function getUserInfo() external view returns (string username, uint256 balance, bool frozen)", 

  "function deposit() external payable",
  "function withdraw(uint256 amount) external",
];