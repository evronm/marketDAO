// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";

/**
 * @title VerifyFlags
 * @notice Helper test to verify flag settings on a deployed DAO
 * @dev Use this to check if your deployed DAO has the expected flags set
 */
contract VerifyFlags is Test {
    // Change this to your deployed DAO address
    address constant DAO_ADDRESS = 0x5FbDB2315678afecb367f032d93F642f64180aa3;

    MarketDAO dao;

    function setUp() public {
        // Fork from your local anvil or whatever network you're using
        // Uncomment if needed:
        // vm.createSelectFork("http://localhost:8545");

        dao = MarketDAO(payable(DAO_ADDRESS));
    }

    function testVerifyFlags() public view {
        bool allowMinting = dao.allowMinting();
        bool restrictPurchases = dao.restrictPurchasesToHolders();
        uint256 flags = dao.flags();

        console.log("DAO Address:", address(dao));
        console.log("DAO Name:", dao.name());
        console.log("Flags (raw):", flags);
        console.log("Allow Minting:", allowMinting);
        console.log("Restrict Purchases:", restrictPurchases);

        // Decode flags manually
        bool flagBit0 = (flags & (1 << 0)) != 0;  // FLAG_ALLOW_MINTING
        bool flagBit1 = (flags & (1 << 1)) != 0;  // FLAG_RESTRICT_PURCHASES

        console.log("Flag bit 0 (allow minting):", flagBit0);
        console.log("Flag bit 1 (restrict purchases):", flagBit1);

        // Expected for Deploy.private.s.sol:
        // flags = 3 (binary: 11)
        // allowMinting = true
        // restrictPurchases = true
    }

    function testCheckBalance() public view {
        address testAccount = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Account #1
        uint256 balance = dao.balanceOf(testAccount, 0);
        uint256 vestedBalance = dao.vestedBalance(testAccount);

        console.log("Test account:", testAccount);
        console.log("Total balance:", balance);
        console.log("Vested balance:", vestedBalance);
        console.log("Unvested balance:", balance - vestedBalance);

        // If balance > 0, this account IS a holder and CAN purchase with restrictions on
    }
}
