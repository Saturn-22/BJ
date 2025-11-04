// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "../interfaces/IUserVault.sol";

contract MockUserVault is IUserVault {
    mapping(address => uint256) public balances;
    mapping(address => bool) public frozenUsers;

    event Transfer(address from, address to, uint256 amount);
    event FreezeUser(address user);
    event UnfreezeUser(address user);

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function transfer(address from, address to, uint256 amount) external override {
        // For testing, we don't need to check balances rigorously.
        // We just simulate the transfer for Gomoku contract's stake management.
        if (from != address(0)) {
            balances[from] -= amount;
        }
        balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function freezeUser(address userAddress) external override {
        frozenUsers[userAddress] = true;
        emit FreezeUser(userAddress);
    }

    function unfreezeUser(address userAddress) external override {
        frozenUsers[userAddress] = false;
        emit UnfreezeUser(userAddress);
    }
}
