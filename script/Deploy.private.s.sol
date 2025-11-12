// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract DeployConfig {
    string constant DAO_NAME = "Private DAO";
    uint256 constant SUPPORT_THRESHOLD = 2000;     // 20% (basis points: 2000/10000)
    uint256 constant QUORUM = 5100;                // 51% (basis points: 5100/10000)
    uint256 constant MAX_PROPOSAL_AGE = 100;       // blocks until proposal expires
    uint256 constant ELECTION_DURATION = 50;       // blocks for voting period
    bool constant ALLOW_MINTING = true;            // can mint new governance tokens
    uint256 constant TOKEN_PRICE = 1e14;           // initial token price
    uint256 constant VESTING_PERIOD = 100;         // initial vesting period is 2 election cycles
    bool constant RESTRICT_PURCHASES = true;       // if true, only existing holders can purchase
    bool constant MINT_ON_PURCHASE = false;        // if true, purchases transfer from DAO; if false, purchases mint new tokens

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

        address[] memory initialHolders = new address[](2);
        initialHolders[0] = msg.sender;
        initialHolders[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        
        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
       initialAmounts[1] = 100;

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
        ResolutionProposal resolutionImpl = new ResolutionProposal();
        TreasuryProposal treasuryImpl = new TreasuryProposal();
        MintProposal mintImpl = new MintProposal();
        ParameterProposal parameterImpl = new ParameterProposal();
        DistributionProposal distributionImpl = new DistributionProposal();

        // Deploy factory with implementation addresses
        ProposalFactory factory = new ProposalFactory(dao, address(resolutionImpl), address(treasuryImpl), address(mintImpl), address(parameterImpl), address(distributionImpl));

        // Register the factory with the DAO to enable proposal creation
        dao.setFactory(address(factory));

        vm.stopBroadcast();
    }
}
