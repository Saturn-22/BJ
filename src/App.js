import React, { useState, useEffect } from 'react';
// import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { HashRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';

import LoggedOutHome from './LoggedOutHome';
import LoggedInHome from './LoggedInHome';
import LoginPage from './login/LoginPage';
import RegisterPage from './register/RegisterPage';
import ChangePasswordPage from './user/ChangePasswordPage';
import UserInfoPage from './user/UserInfoPage';
import RechargePage from './user/RechargePage';
import GamePage from "./game/GamePage";
import WithdrawPage from './user/WithdrawPage';
import Game1Page from "./gomoku/Game1Page";
import GomokuPlay from "./gomoku/GomokuPlay";
import BlackjackGame from "./blackjack/BlackjackGame"; // #blackjack Import Blackjack game
import { initEthers, getContracts } from './contract/contractService';
import { ethers } from 'ethers';


const AppContent = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userAddress, setUserAddress] = useState('');
    const [balance, setBalance] = useState("0");
    const [userInfo, setUserInfo] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const initialize = async () => {
            if (window.ethereum) {
                try {
                    const { provider, userVaultContract } = await initEthers();

                    // 检查网络并提示切换
                    // const { chainId } = await provider.getNetwork();
                    // if (chainId !== 31337) { // Hardhat Localhost chainId // #blackjack 
                    //     await window.ethereum.request({ // #blackjack
                    //         method: 'wallet_switchEthereumChain', // #blackjack
                    //         params: [{ chainId: '0x' + (31337).toString(16) }], // #blackjack
                    //     }); // #blackjack
                    // }
                   
                    const status = await userVaultContract.checkLoginStatus();
                    if (status) {
                        const accounts = await provider.listAccounts();
                        if (accounts.length > 0) {
                            handleLoginSuccess(accounts[0]);
                        }
                    }
                } catch (error) {
                    console.error("Initialization failed:", error);
                }
            }
            
        };

        initialize();

        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                handleLogout();
            } else {
                setUserAddress(accounts[0]);
            }
        };

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    const handleLoginSuccess = async (address) => {
        try {
            const { userVaultContract } = getContracts();
            const info = await userVaultContract.getUserInfo();
            setUserInfo({
              username: info.username,
              balance: info.balance.toString(),
              frozen: info.frozen,
            });
            setIsLoggedIn(true);
            setUserAddress(address);
            navigate('/home');
        } catch(e) {
            console.error("Failed to fetch user info after login:", e);
        }
    };
    
    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserAddress('');
        setUserInfo(null);
        navigate('/');
    };

    // 刷新用户余额 // #blackjack
    const refreshUserBalance = async () => { // #blackjack
        try { // #blackjack
            const { userVaultContract } = getContracts(); // #blackjack
            const info = await userVaultContract.getUserInfo(); // #blackjack
            setUserInfo({ // #blackjack
              username: info.username, // #blackjack
              balance: info.balance.toString(), // #blackjack
              frozen: info.frozen, // #blackjack
            }); // #blackjack
        } catch(e) { // #blackjack
            console.error("Failed to refresh user balance:", e); // #blackjack
        } // #blackjack
    }; // #blackjack

    return (
        <Routes>
            <Route 
                path="/" 
                element={
                    isLoggedIn ? <Navigate to="/home" /> : 
                    <LoggedOutHome 
                        onRegisterClick={() => navigate('/register')}
                        onLoginClick={() => navigate('/login')}
                        onPlayClick={() => alert("Please login first")}
                    />
                } 
            />
            <Route 
                path="/home" 
                element={
                    isLoggedIn ? <LoggedInHome userInfo={userInfo} onLogout={handleLogout} onPlayClick={() => navigate('/game')} onUserInfoClick={() => navigate('/user-info')} /> : 
                    <Navigate to="/login" />
                } 
            />
            <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} onBack={() => navigate('/')} />} />
            <Route path="/register" element={<RegisterPage onRegisterSuccess={() => navigate('/login')} onBack={() => navigate('/')} />} />
            <Route path="/change-password" element={isLoggedIn ? <ChangePasswordPage onBack={() => navigate('/user-info')} /> : <Navigate to="/login" />} />
            <Route path="/user-info" element={isLoggedIn ? <UserInfoPage userInfo={userInfo} onBack={() => navigate('/home')} onChangePassword={() => navigate('/change-password')} onRecharge={() => navigate('/recharge')} onWithdraw={() => navigate('/withdraw')} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/recharge" element={isLoggedIn ? <RechargePage onBack={() => navigate('/user-info')} /> : <Navigate to="/login" />} />
            <Route path="/withdraw" element={isLoggedIn ? <WithdrawPage onBack={() => navigate('/user-info')} /> : <Navigate to="/login" />} />
            <Route 
                path="/game" 
                element={
                    isLoggedIn ? 
                    <GamePage 
                        onBack={() => navigate('/home')} 
                        onSelectGame1={() => navigate('/game1')}
                        onSelectGame2={() => navigate('/blackjack')} // #blackjack
                    /> : 
                    <Navigate to="/login" />
                } 
            />
            <Route path="/game1" element={isLoggedIn ? <Game1Page onBack={() => navigate('/game')} /> : <Navigate to="/login" />} />
            <Route path="/game1/:id" element={isLoggedIn ? <GomokuPlay /> : <Navigate to="/login" />} />
            {/* #blackjack Start of Blackjack Route */}
            <Route 
                path="/blackjack" 
                element={
                    isLoggedIn ? 
                    <BlackjackGame 
                        onBack={() => navigate('/game')} 
                        userInfo={userInfo}
                        onBalanceUpdate={refreshUserBalance}
                    /> : 
                    <Navigate to="/login" />
                } 
            />
            {/* #blackjack End of Blackjack Route */}
        </Routes>
    );
};


const App = () => {
    return (
        <Router>
        <AppContent />
      </Router>
    );
}

export default App;
