// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";

contract DeployConfig {
    string constant DAO_NAME = "Market DAO";
    uint256 constant SUPPORT_THRESHOLD = 2000;     // 20% (basis points: 2000/10000)
    uint256 constant QUORUM = 5100;                // 51% (basis points: 5100/10000)
    uint256 constant MAX_PROPOSAL_AGE = 100;       // blocks until proposal expires
    uint256 constant ELECTION_DURATION = 50;       // blocks for voting period
    bool constant ALLOW_MINTING = true;            // can mint new governance tokens
    uint256 constant TOKEN_PRICE = 1e14;           // initial token price
    uint256 constant VESTING_PERIOD = 100;         // initial vesting period is 2 election cycles
    bool constant RESTRICT_PURCHASES = false;      // if true, only existing holders can purchase

    // Flag bit positions (must match MarketDAO contract)
    uint256 constant FLAG_ALLOW_MINTING = 1 << 0;
    uint256 constant FLAG_RESTRICT_PURCHASES = 1 << 1;

    function buildFlags() internal pure returns (uint256) {
        uint256 flags = 0;
        if (ALLOW_MINTING) flags |= FLAG_ALLOW_MINTING;
        if (RESTRICT_PURCHASES) flags |= FLAG_RESTRICT_PURCHASES;
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

        ProposalFactory factory = new ProposalFactory(dao);

        // Register the factory with the DAO to enable proposal creation
        dao.setFactory(address(factory));

        vm.stopBroadcast();
    }
}
