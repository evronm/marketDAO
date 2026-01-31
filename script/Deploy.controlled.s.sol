// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/GenericProposal.sol";
import "../src/ProposalTypes.sol";

contract DeployConfig {
    string constant DAO_NAME = "Controlled Sale DAO";
    uint256 constant SUPPORT_THRESHOLD = 2000;     // 20% (basis points: 2000/10000)
    uint256 constant QUORUM = 5100;                // 51% (basis points: 5100/10000)
    uint256 constant MAX_PROPOSAL_AGE = 100;       // blocks until proposal expires
    uint256 constant ELECTION_DURATION = 50;       // blocks for voting period
    bool constant ALLOW_MINTING = true;            // can mint new governance tokens
    uint256 constant TOKEN_PRICE = 1e14;           // initial token price
    uint256 constant VESTING_PERIOD = 100;         // initial vesting period is 2 election cycles
    bool constant RESTRICT_PURCHASES = false;      // if true, only existing holders can purchase
    bool constant MINT_ON_PURCHASE = true;         // if true, purchases transfer from DAO; if false, purchases mint new tokens

    // Flag bit positions (must match MarketDAO contract)
    uint256 constant FLAG_ALLOW_MINTING = 1 << 0;
    uint256 constant FLAG_RESTRICT_PURCHASES = 1 << 1;
    uint256 constant FLAG_MINT_ON_PURCHASE = 1 << 2;

    function buildFlags() internal pure returns (uint256) {
        uint256 flags = 0;
        if (ALLOW_MINTING) flags |= FLAG_ALLOW_MINTING;
        if (RESTRICT_PURCHASES) flags |= FLAG_RESTRICT_PURCHASES;
        if (MINT_ON_PURCHASE) flags |= FLAG_MINT_ON_PURCHASE;
        return flags;
    }
}

contract DeployScript is Script, DeployConfig {
    function getTreasuryConfig() internal pure returns (string[] memory) {
        string[] memory config = new string[](3);
        config[0] = "ETH";
        config[1] = "ERC20";
        config[2] = "ERC1155";
        return config;
    }

    function run() external {
        // Use foundry's account system instead of env variable
        vm.startBroadcast();

        address[] memory initialHolders = new address[](1);
        initialHolders[0] = msg.sender;

        uint256[] memory initialAmounts = new uint256[](1);
        initialAmounts[0] = 100;

        MarketDAO dao = new MarketDAO(
            DAO_NAME,
            SUPPORT_THRESHOLD,
            QUORUM,
            MAX_PROPOSAL_AGE,
            ELECTION_DURATION,
            buildFlags(),
            TOKEN_PRICE,
            VESTING_PERIOD,
            getTreasuryConfig(),
            initialHolders,
            initialAmounts
        );

        // Deploy implementation contracts
        GenericProposal genericImpl = new GenericProposal();
        DistributionProposal distributionImpl = new DistributionProposal();

        // Deploy factory with implementation addresses
        ProposalFactory factory = new ProposalFactory(dao, address(genericImpl), address(distributionImpl));

        // Register the factory with the DAO to enable proposal creation
        dao.setFactory(address(factory));

        vm.stopBroadcast();

        // Log deployment info
        console.log("Deployed Controlled Sale DAO at:", address(dao));
        console.log("Deployed ProposalFactory at:", address(factory));
        console.log("");
        console.log("Configuration:");
        console.log("- Token purchases transfer from DAO treasury (not minted)");
        console.log("- DAO must mint tokens to itself via governance before they can be purchased");
        console.log("- Anyone can purchase tokens (no restrictions)");
        console.log("- Token price:", TOKEN_PRICE);
        console.log("");
        console.log("To make tokens available for purchase:");
        console.log("1. Create a mint proposal to mint tokens to the DAO address");
        console.log("2. Pass the proposal through voting");
        console.log("3. Execute the proposal");
        console.log("4. Tokens in DAO treasury will be available for public purchase");
    }
}
