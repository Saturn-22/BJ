# Web3 Gomoku DApp Backend

This repository contains the backend smart contracts for a decentralized Gomoku (Five-in-a-Row) DApp built on the Ethereum blockchain. It uses Hardhat as the development environment.

The system allows players to create and join games, compete against each other with cryptocurrency stakes, and have the winner automatically receive the prize pool.

<br>

## Table of Contents
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
  - [Compile](#compile)
  - [Test](#test)
  - [Deployment](#deployment)
- [License](#license)

<br>

---

## Architecture

The backend consists of two main smart contracts:

- **`UserVaultSystem.sol`**: Manages user accounts, balances, registration, login, and security features like account freezing. It acts as a secure vault for user funds.
- **`Gomoku.sol`**: Contains all the game logic, including creating/joining games, managing the board state, processing moves, and determining the winner. It interacts with `UserVaultSystem` to handle stakes but does not hold user funds long-term.

<br>

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/) (>=18.0.0)
- [NPM](https://www.npmjs.com/)

### Installation

1.  Clone the repository:
    ```sh
    git clone <YOUR_REPOSITORY_URL>
    cd Web3Gomoku
    ```
2.  Install dependencies:
    ```sh
    npm install
    ```

### Configuration

Create a `.env` file in the project root directory and add the following environment variables. This file is for sensitive information and should not be committed to version control.

```
SEPOLIA_RPC_URL="YOUR_ALCHEMY_OR_INFURA_RPC_URL"
PRIVATE_KEY="YOUR_WALLET_PRIVATE_KEY_WITHOUT_0x"
ETHERSCAN_API_KEY="YOUR_ETHERSCAN_API_KEY"
```

<br>

## Usage

### Compile

To compile the smart contracts, run:

```sh
npx hardhat compile
```

### Test

To run the unit tests for the contracts, execute:

```sh
npx hardhat test
```

### Deployment

The deployment process involves two steps and must be done in order.

**Step 1: Deploy `UserVaultSystem`**

Run the deployment script for the vault contract.

```sh
npx hardhat run scripts/deployUserVault.js --network sepolia
```

Copy the deployed contract address from the terminal output.

**Step 2: Deploy `Gomoku`**

1.  Open `scripts/deploy.js`.
2.  Paste the `UserVaultSystem` address you just copied into the `USER_VAULT_ADDRESS` variable.
3.  Run the deployment script for the Gomoku contract.

```sh
npx hardhat run scripts/deploy.js --network sepolia
```

**Step 3: Whitelist `Gomoku` contract**

After both contracts are deployed, you must call the `addToWhitelist` function on the `UserVaultSystem` contract, passing the `Gomoku` contract's address as the argument. This authorizes the game contract to manage stakes. This can be done via Etherscan's "Write Contract" interface.

<br>

## License

This project is licensed under the MIT License.
