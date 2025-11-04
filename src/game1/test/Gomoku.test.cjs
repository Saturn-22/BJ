const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gomoku", function () {
    let gomoku;
    let mockUserVault;
    let owner, player1, player2, other;

    beforeEach(async function () {
        [owner, player1, player2, other] = await ethers.getSigners();

        // Deploy MockUserVault
        const MockUserVault = await ethers.getContractFactory("MockUserVault");
        mockUserVault = await MockUserVault.deploy();
        
        // Deploy Gomoku with MockUserVault address
        const Gomoku = await ethers.getContractFactory("Gomoku");
        gomoku = await Gomoku.deploy(mockUserVault.target);

        // Mint some funds for players
        const initialBalance = ethers.parseEther("10");
        await mockUserVault.mint(player1.address, initialBalance);
        await mockUserVault.mint(player2.address, initialBalance);
    });

    describe("createGame", function () {
        const stake = ethers.parseEther("1");

        it("Should create a new game successfully", async function () {
            await expect(gomoku.connect(player1).createGame(stake))
                .to.emit(gomoku, "GameCreated")
                .withArgs(1, player1.address, stake);

            const game = await gomoku.getGameDetails(1);
            expect(game.gameId).to.equal(1);
            expect(game.players[0]).to.equal(player1.address);
            expect(game.stake).to.equal(stake);
            expect(game.status).to.equal(0); // Lobby
            expect(await gomoku.playerCurrentGame(player1.address)).to.equal(1);
        });

        it("Should transfer stake to the contract", async function () {
            await gomoku.connect(player1).createGame(stake);
            expect(await mockUserVault.balances(gomoku.target)).to.equal(stake);
        });

        it("Should fail if stake is 0", async function () {
            await expect(gomoku.connect(player1).createGame(0))
                .to.be.revertedWith("Stake must be greater than 0");
        });

        it("Should fail if player is already in a game", async function () {
            await gomoku.connect(player1).createGame(stake);
            await expect(gomoku.connect(player1).createGame(stake))
                .to.be.revertedWith("Player is already in a game");
        });
    });

    describe("joinGame", function () {
        const stake = ethers.parseEther("1");

        beforeEach(async function () {
            await gomoku.connect(player1).createGame(stake);
        });

        it("Should allow a player to join a game", async function () {
            await expect(gomoku.connect(player2).joinGame(1))
                .to.emit(gomoku, "GameStarted")
                .withArgs(1, player1.address, player2.address);

            const game = await gomoku.getGameDetails(1);
            expect(game.players[1]).to.equal(player2.address);
            expect(game.status).to.equal(1); // InProgress
            expect(game.turn).to.equal(player1.address);
            expect(await gomoku.playerCurrentGame(player2.address)).to.equal(1);
        });

        it("Should transfer stake and freeze users", async function () {
            await gomoku.connect(player2).joinGame(1);
            expect(await mockUserVault.balances(gomoku.target)).to.equal(stake * 2n);
            expect(await mockUserVault.frozenUsers(player1.address)).to.be.true;
            expect(await mockUserVault.frozenUsers(player2.address)).to.be.true;
        });

        it("Should fail if game does not exist", async function () {
            await expect(gomoku.connect(player2).joinGame(999))
                .to.be.revertedWith("Game does not exist");
        });

        it("Should fail if player tries to join their own game", async function () {
            await expect(gomoku.connect(player1).joinGame(1))
                .to.be.revertedWith("Cannot join your own game");
        });

        it("Should fail if game is not in Lobby state", async function () {
            await gomoku.connect(player2).joinGame(1); // Game is now InProgress
            await expect(gomoku.connect(other).joinGame(1))
                .to.be.revertedWith("Game is not in Lobby state");
        });
    });

    describe("makeMove and Game Logic", function () {
        const stake = ethers.parseEther("1");
        const initialBalance = ethers.parseEther("10");

        beforeEach(async function () {
            await gomoku.connect(player1).createGame(stake);
            await gomoku.connect(player2).joinGame(1);
        });

        it("Should allow a player to make a move", async function () {
            await expect(gomoku.connect(player1).makeMove(1, 7, 7))
                .to.emit(gomoku, "MoveMade")
                .withArgs(1, player1.address, 7, 7);
            
            const board = await gomoku.getBoard(1);
            expect(board[7][7]).to.equal(1); // Player 1's piece
            const game = await gomoku.getGameDetails(1);
            expect(game.turn).to.equal(player2.address);
        });

        it("Should fail if it is not the player's turn", async function () {
            await expect(gomoku.connect(player2).makeMove(1, 7, 7))
                .to.be.revertedWith("Not your turn");
        });

        it("Should declare a winner correctly (horizontal)", async function () {
            // P1 moves
            await gomoku.connect(player1).makeMove(1, 0, 0); // Turn P2
            await gomoku.connect(player2).makeMove(1, 1, 0); // Turn P1
            await gomoku.connect(player1).makeMove(1, 0, 1); // Turn P2
            await gomoku.connect(player2).makeMove(1, 1, 1); // Turn P1
            await gomoku.connect(player1).makeMove(1, 0, 2); // Turn P2
            await gomoku.connect(player2).makeMove(1, 1, 2); // Turn P1
            await gomoku.connect(player1).makeMove(1, 0, 3); // Turn P2
            await gomoku.connect(player2).makeMove(1, 1, 3); // Turn P1
            
            // Player 1 makes the winning move
            await expect(gomoku.connect(player1).makeMove(1, 0, 4))
                .to.emit(gomoku, "GameEnded")
                .withArgs(1, player1.address, player2.address);

            const game = await gomoku.getGameDetails(1);
            expect(game.status).to.equal(2); // Finished
            expect(game.winner).to.equal(player1.address);
            // Winner's balance should be initial + stake since they won player2's stake
            expect(await mockUserVault.balances(player1.address)).to.equal(initialBalance + stake);
            expect(await mockUserVault.frozenUsers(player1.address)).to.be.false;
            expect(await mockUserVault.frozenUsers(player2.address)).to.be.false;
            expect(await gomoku.playerCurrentGame(player1.address)).to.equal(0);
        });
        
        it("Should handle a draw correctly", async function () {
            // Manually set the moveCount on-chain to simulate a near-full board.
            await gomoku.connect(owner)._setMoveCount(1, (15 * 15 - 1));

            // P1 makes the "final" move that doesn't result in a win
            await expect(gomoku.connect(player1).makeMove(1, 14, 14))
                .to.emit(gomoku, "GameDrawn")
                .withArgs(1);
            
            const endedGame = await gomoku.getGameDetails(1);
            expect(endedGame.status).to.equal(2); // Finished
            expect(endedGame.winner).to.equal(ethers.ZeroAddress); // winner
            
            // Each player gets their stake back. Their balance should be the same as their initial balance.
            expect(await mockUserVault.balances(player1.address)).to.equal(initialBalance);
            expect(await mockUserVault.balances(player2.address)).to.equal(initialBalance);
        });
    });
});
