// scripts/deploy_all.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=================================");
  console.log("Blackjack DApp Deployment");
  console.log("=================================\n");

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance < hre.ethers.parseEther("0.01")) {
    console.warn("\nWarning: Low balance! Make sure you have enough ETH for deployment.\n");
  }

  console.log("\n---------------------------------");
  console.log("Step 1: Deploying UserVaultSystem");
  console.log("---------------------------------");
  
  const VaultFQ = "contracts/UserVaultSystem.sol:UserVaultSystem";
  const Vault = await hre.ethers.getContractFactory(VaultFQ);
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  const VAULT = await vault.getAddress();
  console.log("UserVaultSystem deployed at:", VAULT);

  console.log("\n---------------------------------");
  console.log("Step 2: Deploying BlackjackSettlement");
  console.log("---------------------------------");
  
  const BJFQ = "contracts/blackjack_settlement.sol:BlackjackSettlement";
  const BJ = await hre.ethers.getContractFactory(BJFQ);
  const bj = await BJ.deploy(VAULT);
  await bj.waitForDeployment();
  const BLACKJACK = await bj.getAddress();
  console.log("BlackjackSettlement deployed at:", BLACKJACK);

  console.log("\n---------------------------------");
  console.log("Step 3: Configuring Contracts");
  console.log("---------------------------------");
  
  const vaultAsOwner = await hre.ethers.getContractAt(VaultFQ, VAULT, deployer);
  console.log("Adding Blackjack to Vault whitelist...");
  const tx = await vaultAsOwner.addToWhitelist(BLACKJACK);
  await tx.wait();
  console.log("Blackjack whitelisted in Vault");

  console.log("\n---------------------------------");
  console.log("Step 4: Saving Deployment Info");
  console.log("---------------------------------");
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      UserVaultSystem: VAULT,
      BlackjackSettlement: BLACKJACK
    },
    blockNumber: await hre.ethers.provider.getBlockNumber(),
    gasUsed: "Estimated during deployment"
  };
  
  const filename = `./addresses.${hre.network.name}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to: ${filename}`);

  console.log("\n---------------------------------");
  console.log("Step 5: Updating Contract Config");
  console.log("---------------------------------");
  
  const contractConfigPath = path.join(__dirname, '..', '..', 'contract', 'contractConfig.js');
  
  try {
    let configContent = fs.readFileSync(contractConfigPath, 'utf8');
    
    configContent = configContent.replace(
      /export const BLACKJACK_ADDRESS = ["'].*["'];?/,
      `export const BLACKJACK_ADDRESS = "${BLACKJACK}";`
    );
    
    if (!configContent.includes('BLACKJACK_ADDRESS')) {
      configContent = configContent.replace(
        /(export const GOMOKU_ADDRESS = ["'].*["'];?)/,
        `$1\n\n// Blackjack Settlement Contract Address\nexport const BLACKJACK_ADDRESS = "${BLACKJACK}";`
      );
    }
    
    fs.writeFileSync(contractConfigPath, configContent);
    console.log(`Updated contractConfig.js with Blackjack address`);
    console.log(`   Path: ${contractConfigPath}`);
  } catch (error) {
    console.warn(`Could not auto-update contractConfig.js: ${error.message}`);
    console.log(`\n Please manually update src/contract/contractConfig.js:`);
    console.log(`   export const BLACKJACK_ADDRESS = "${BLACKJACK}";`);
  }

  console.log("\n=================================");
  console.log("Deployment Complete!");
  console.log("=================================\n");
  console.log("Contract Addresses:");
  console.log("  UserVaultSystem:", VAULT);
  console.log("  BlackjackSettlement:", BLACKJACK);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed:");
    console.error(error);
    process.exit(1);
  });