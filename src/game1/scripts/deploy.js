const { ethers } = require("hardhat");

async function main() {
  // ==================================================================
  // 1. !! 修改这里 !!: 将此地址替换为您已部署的 UserVaultSystem 合约地址
  const USER_VAULT_ADDRESS = "0x853aC7ab3cb4Bb2e27f9513Dcf08078f44b545D2"; 
  // ==================================================================

  if (USER_VAULT_ADDRESS === "0xYourUserVaultSystemContractAddressHere") {
    console.error("请在 scripts/deploy.js 文件中设置真实的 UserVaultSystem 合约地址。");
    process.exit(1);
  }

  console.log("正在部署 Gomoku 合约...");
  
  const gomokuFactory = await ethers.getContractFactory("Gomoku");
  const gomoku = await gomokuFactory.deploy(USER_VAULT_ADDRESS);
  await gomoku.waitForDeployment();

  const gomokuAddress = await gomoku.getAddress();
  console.log(`Gomoku 合约已成功部署到地址: ${gomokuAddress}`);

  console.log("\n==================================================================");
  console.log("部署完成! 请执行下一步操作:");
  console.log("1. 复制上面新部署的 Gomoku 合约地址。");
  console.log(`2. 调用 UserVaultSystem 合约 (${USER_VAULT_ADDRESS}) 的 addToWhitelist 函数，将 Gomoku 合约地址添加进白名单。`);
  console.log(`   示例: userVaultSystem.addToWhitelist("${gomokuAddress}")`);
  console.log("==================================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
