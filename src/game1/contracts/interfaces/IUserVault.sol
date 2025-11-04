// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IUserVault {
    function transfer(address from, address to, uint256 amount) external;
    function freezeUser(address userAddress) external;
    function unfreezeUser(address userAddress) external;
}
