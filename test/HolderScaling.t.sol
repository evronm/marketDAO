// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract HolderScalingTest is Test, IERC1155Receiver {
    MarketDAO dao;
    ProposalFactory factory;

    function setUp() public {
        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        address[] memory initialHolders = new address[](0);
        uint256[] memory initialAmounts = new uint256[](0);

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support threshold
            5100, // 51% quorum
            100,
            50,
            true,
            0,
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));
    }

    function testGasWith10Holders() public {
        _testWithHolders(10);
    }

    function testGasWith50Holders() public {
        _testWithHolders(50);
    }

    function testGasWith100Holders() public {
        _testWithHolders(100);
    }

    function testGasWith200Holders() public {
        _testWithHolders(200);
    }

    function testGasWith500Holders() public {
        _testWithHolders(500);
    }

    function testGasWith1000Holders() public {
        _testWithHolders(1000);
    }

    function testGasWith2000Holders() public {
        _testWithHolders(2000);
    }

    function testGasWith10000Holders() public {
        _testWithHolders(10000);
    }

    function _testWithHolders(uint256 numHolders) internal {
        // Need to create a MintProposal to get tokens to distribute
        // First, give the deployer some tokens to bootstrap
        address[] memory bootstrapHolders = new address[](1);
        bootstrapHolders[0] = address(this);
        uint256[] memory bootstrapAmounts = new uint256[](1);
        bootstrapAmounts[0] = numHolders * 100;

        // Recreate DAO with initial tokens
        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support threshold
            5100, // 51% quorum
            100,
            50,
            true,
            0,
            0, // No vesting
            treasuryConfig,
            bootstrapHolders,
            bootstrapAmounts
        );

        factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));

        // Distribute tokens to holders - keep enough for proposer to trigger
        uint256 totalSupply = numHolders * 100;
        uint256 supportNeeded = (totalSupply * 2000) / 10000; // 20%

        // Give proposer enough to trigger (keep the support needed amount)
        address proposer = address(uint160(1000));
        dao.safeTransferFrom(address(this), proposer, 0, supportNeeded, "");

        // Distribute rest to other holders
        uint256 remaining = totalSupply - supportNeeded;
        uint256 perHolder = remaining / (numHolders - 1);

        for(uint256 i = 1; i < numHolders; i++) {
            address holder = address(uint160(i + 1000));
            dao.safeTransferFrom(address(this), holder, 0, perHolder, "");
        }

        // Create a proposal from proposer
        vm.startPrank(proposer);
        dao.setApprovalForAll(address(factory), true);

        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");
        dao.setApprovalForAll(address(proposal), true);

        console.log("Total supply:", dao.totalSupply(0));
        console.log("Support needed (20%):", supportNeeded);
        console.log("Proposer balance:", dao.balanceOf(proposer, 0));

        // This triggers the election and creates the snapshot
        uint256 gasBefore = gasleft();
        proposal.addSupport(supportNeeded); // Add exactly enough to trigger
        uint256 gasUsed = gasBefore - gasleft();

        bool triggered = proposal.electionTriggered();

        vm.stopPrank();

        console.log("Holders:", numHolders);
        console.log("Election triggered:", triggered);
        console.log("Gas used for addSupport:", gasUsed);
        if (triggered && numHolders > 0) {
            console.log("Gas per holder (snapshot):", gasUsed / numHolders);
        }
        console.log("");
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
