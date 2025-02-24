// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";

contract DeployConfig {
    string constant DAO_NAME = "Market DAO";
    uint256 constant SUPPORT_THRESHOLD = 20;       // 20% of tokens needed for proposal
    uint256 constant QUORUM = 51;                  // 51% needed for valid vote
    uint256 constant MAX_PROPOSAL_AGE = 100;       // blocks until proposal expires
    uint256 constant ELECTION_DURATION = 50;       // blocks for voting period
    bool constant ALLOW_MINTING = true;            // can mint new governance tokens
    uint256 constant TOKEN_PRICE = 0;       // blocks for voting period
}

contract DeployScript is Script, DeployConfig {
    function getTreasuryConfig() internal pure returns (string[] memory) {
        string[] memory config = new string[](2);
        config[0] = "ETH";
        config[1] = "ERC20";
        return config;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address[] memory initialHolders = new address[](1);
        initialHolders[0] = vm.addr(deployerPrivateKey);
        
        uint256[] memory initialAmounts = new uint256[](1);
        initialAmounts[0] = 100;

        MarketDAO dao = new MarketDAO(
            DAO_NAME,
            SUPPORT_THRESHOLD,
            QUORUM,
            MAX_PROPOSAL_AGE,
            ELECTION_DURATION,
            ALLOW_MINTING,
            TOKEN_PRICE,
            getTreasuryConfig(),
            initialHolders,
            initialAmounts
        );

        ProposalFactory factory = new ProposalFactory(dao);

        vm.stopBroadcast();
    }
}
