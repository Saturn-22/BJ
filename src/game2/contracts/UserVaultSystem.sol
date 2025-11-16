// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

/*
pushToPool函数：玩家点击开始或者rise时触发
scoopFromPool函数：给胜者
freezeUser函数：开启赌局前冻结账户，不允许赌局期前提现
unfreezeUser函数：赌局结束后恢复
addToWhitelist函数；给每个游戏管理者白名单进行转账操作
removeFromWhitelist：
*/
contract UserVaultSystem {
    struct User {
        string username;
        uint256 balance; // wei
        bytes32 password; // hash
        bool exists;
        uint256 lastActivity;
        bool frozen;
        bool isLoggedIn; 
    }

    address public owner;
    uint256 public sessionTimeout = 60*60*100; //second：can change

    mapping(address => User) public users;
    mapping(address => bool) public whitelist;

    uint256 public gamePoolBalance=100 ether;


    event UserRegistered(address indexed userAddress, string username);
    event Deposited(address indexed userAddress, uint256 amount);
    event Withdrawn(address indexed userAddress, uint256 amount);
    event LoggedIn(address indexed userAddress);
    event LoggedOut(address indexed userAddress);
    // event Transferred(address indexed from, address indexed to, uint256 amount);
    event PushedToPool(address indexed user, uint256 amount);
    event ScoopedFromPool(address indexed user, uint256 amount);
    event WhitelistAdded(address indexed account);
    event WhitelistRemoved(address indexed account);
    event UserFrozen(address indexed userAddress);
    event UserUnfrozen(address indexed userAddress);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyOwnerOrWhitelist() {
        require(msg.sender == owner || whitelist[msg.sender], "Not owner or whitelist");
        _;
    }

    modifier onlyRegisteredUser() {
        require(users[msg.sender].exists, "User not registered");
        _;
    }

    modifier onlyLoggedIn() {
        require(users[msg.sender].isLoggedIn, "User not logged in");
        require(!isSessionExpired(msg.sender), "Session expired, please log in again");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerUser(string calldata username, string calldata password) external {
        require(!users[msg.sender].exists, "User already registered");
        require(bytes(username).length > 0, "Username cannot be empty");
        
        bytes32 hashedPassword = keccak256(abi.encodePacked(password));

        users[msg.sender] = User({
            username: username,
            balance: 0,
            password: hashedPassword,
            exists: true,
            lastActivity: block.timestamp, 
            frozen: false,
            isLoggedIn: true 
        });

        emit UserRegistered(msg.sender, username);
}

    function login(string calldata password) external onlyRegisteredUser {
        require(users[msg.sender].password == keccak256(abi.encodePacked(password)), "Incorrect password");

        users[msg.sender].isLoggedIn = true;
        users[msg.sender].lastActivity = block.timestamp;
        emit LoggedIn(msg.sender);
    }

    function logout() public onlyRegisteredUser {
        require(users[msg.sender].isLoggedIn, "User not logged in");
        users[msg.sender].isLoggedIn = false;
        emit LoggedOut(msg.sender);
    }

    function checkLoginStatus() external view returns (bool) {
        User storage user = users[msg.sender];

        
        if (!user.exists) {
            return false;
        }

        if (block.timestamp > user.lastActivity + sessionTimeout) {
            return false; 
        }

        return user.isLoggedIn;
}

    function isSessionExpired(address userAddress) public view returns (bool) {
        require(users[userAddress].exists, "User not registered");
        if (!users[userAddress].isLoggedIn) {
            return true;
        }
        return (block.timestamp - users[userAddress].lastActivity) > sessionTimeout;
    }

    //For downstream use
    function updateLastActivity() public  {
        users[msg.sender].lastActivity = block.timestamp;
    }

    function verifyPassword(string calldata password) external view onlyRegisteredUser returns (bool) {
        return users[msg.sender].password == keccak256(abi.encodePacked(password));
    }

    function changePassword(string calldata oldPassword, string calldata newPassword) external onlyRegisteredUser onlyLoggedIn {
        require(users[msg.sender].password == keccak256(abi.encodePacked(oldPassword)), "Old password incorrect");
        require(bytes(newPassword).length > 0, "New password cannot be empty");

        users[msg.sender].password = keccak256(abi.encodePacked(newPassword));
        updateLastActivity();
    }

    function deposit() external payable onlyRegisteredUser onlyLoggedIn {
        require(msg.value > 0, "Deposit amount must be greater than 0");

        users[msg.sender].balance += msg.value;
        updateLastActivity();

        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external onlyRegisteredUser onlyLoggedIn {
        require(!users[msg.sender].frozen, "User account is frozen");
        require(amount > 0, "Withdrawal amount must be greater than 0");
        require(users[msg.sender].balance >= amount, "Insufficient balance");
        require(address(this).balance >= amount, "Vault has insufficient funds");

        users[msg.sender].balance -= amount;
        updateLastActivity();

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    //For downstream use
    function addToWhitelist(address account) external onlyOwner {
        whitelist[account] = true;
        emit WhitelistAdded(account);
    }

    //For downstream use
    function removeFromWhitelist(address account) external onlyOwner {
        whitelist[account] = false;
        emit WhitelistRemoved(account);
    }

    //For downstream use
    // function transfer(address from, address to, uint256 amount) external onlyOwnerOrWhitelist {
    //     require(users[from].exists, "Sender not registered");
    //     require(users[to].exists, "Recipient not registered");
    //     require(amount > 0, "Transfer amount must be greater than 0");
    //     require(users[from].balance >= amount, "Insufficient balance for transfer");

    //     require(
    //          msg.sender == owner || whitelist[msg.sender],
    //         "Not authorized"
    //     );

    //     users[from].balance -= amount;
    //     users[to].balance += amount;

    //     emit Transferred(from, to, amount);
    // }
    function pushToPool(uint256 amount) external onlyRegisteredUser onlyLoggedIn {
        require(amount > 0, "Amount must be greater than 0");
        require(users[msg.sender].balance >= amount, "Insufficient balance");
        require(!users[msg.sender].frozen, "User account is frozen");

        users[msg.sender].balance -= amount;

        gamePoolBalance += amount;

        emit PushedToPool(msg.sender, amount); 
    }

    function scoopFromPool(address to, uint256 amount) external onlyOwnerOrWhitelist {
        require(users[to].exists, "Recipient not registered");
        require(amount > 0, "Amount must be greater than 0");
        require(gamePoolBalance >= amount, "Insufficient pool balance");

        gamePoolBalance -= amount;

        users[to].balance += amount;

        emit ScoopedFromPool(msg.sender, amount);
    }

    function addToPool(uint256 amount) external onlyOwnerOrWhitelist {
        require(amount > 0, "Amount must be > 0");

        gamePoolBalance += amount;
    }

    function removeFromPool(uint256 amount) external onlyOwnerOrWhitelist {
        require(amount > 0, "Amount must be > 0");
        require(gamePoolBalance >= amount, "Insufficient pool balance");

        gamePoolBalance -= amount;
    }

    //For downstream use
    // function freezeUser(address userAddress) external onlyOwnerOrWhitelist {
    //     require(users[userAddress].exists, "User not registered");
    //     require(!users[userAddress].frozen, "User already frozen");

    //     users[userAddress].frozen = true;
    //     emit UserFrozen(userAddress);
    // }

    // //For downstream use
    // function unfreezeUser(address userAddress) external onlyOwnerOrWhitelist {
    //     require(users[userAddress].exists, "User not registered");
    //     require(users[userAddress].frozen, "User is not frozen");

    //     users[userAddress].frozen = false;
    //     emit UserUnfrozen(userAddress);
    // }

    //For downstream use
    function isBalanceGreaterThan(address userAddress, uint256 amount) external view returns (bool) {
        require(users[userAddress].exists, "User is not registered");
        return users[userAddress].balance > amount;
    }
    
    //For downstream use
    function getUserInfo() external view onlyRegisteredUser onlyLoggedIn returns (
        string memory username,
        uint256 balance,
        bool frozen
    ) {
        User storage user = users[msg.sender];
        return (user.username, user.balance, user.frozen);
    }

    //For downstream use
    function getVaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function isAdmin(address account) external view returns (bool) {
        return account == owner || whitelist[account];
    }
}
