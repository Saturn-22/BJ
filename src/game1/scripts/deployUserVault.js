const { ethers } = require("hardhat");

async function main() {
  // 1. 设置您真实的合约名
  const contractName = "UserVaultSystem"; // <--- 如果您的合约名不同，请修改这里

  console.log(`正在部署 ${contractName} 合约...`);

  // 2. 编译并部署合约
  const contractFactory = await ethers.getContractFactory(contractName);
  const contract = await contractFactory.deploy(); // <-- 如果构造函数需要参数，请在这里传入
  await contract.waitForDeployment();

  // 3. 获取并打印合约地址
  const contractAddress = await contract.getAddress();
  console.log(`✅ ${contractName} 合约已成功部署到地址: ${contractAddress}`);

  console.log("\n==================================================================");
  console.log("部署完成! 请执行下一步操作:");
  console.log(`1. 复制上面新部署的 ${contractName} 合约地址 (${contractAddress})。`);
  console.log("2. 打开 `scripts/deploy.js` 文件 (这是Gomoku的部署脚本)。");
  console.log(`3. 将 USER_VAULT_ADDRESS 变量的值替换为这个新地址。`);
  console.log("==================================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
