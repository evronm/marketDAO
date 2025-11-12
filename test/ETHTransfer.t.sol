// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

// Smart contract that can receive ETH
contract ETHReceiver {
    uint256 public receivedAmount;

    receive() external payable {
        receivedAmount = msg.value;
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}

// Malicious contract that tries to reenter
contract ReentrantAttacker {
    MarketDAO public dao;
    ProposalFactory public factory;
    TreasuryProposal public attackProposal;
    bool public attacked;

    constructor(MarketDAO _dao, ProposalFactory _factory) {
        dao = _dao;
        factory = _factory;
    }

    function setupAttack() external {
        // Create a proposal to send ETH to this contract
        attackProposal = factory.createTreasuryProposal(
            "Attack proposal",
            address(this),
            1 ether,
            address(0),
            0
        );
    }

    receive() external payable {
        // Try to reenter by executing the proposal again
        if (!attacked) {
            attacked = true;
            try attackProposal.execute() {
                // If this succeeds, reentrancy guard failed
                revert("Reentrancy guard failed!");
            } catch {
                // Expected behavior - reentrancy blocked
            }
        }
    }

    // ERC1155 receiver interface - required to receive governance tokens
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}

// Contract that rejects ETH
contract ETHRejecter {
    // No receive or fallback function - will reject ETH
}

contract ETHTransferTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;

    address proposer = address(0x1);
    address voter1 = address(0x2);

    function setUp() public {
        address[] memory initialHolders = new address[](2);
        initialHolders[0] = proposer;
        initialHolders[1] = voter1;

        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support
            5100, // 51% quorum
            100,
            50,
            0, // flags (allowMinting=False)
            0,
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));

        // Fund the DAO
        vm.deal(address(dao), 100 ether);
    }

    function testETHTransferToSmartContract() public {
        // Deploy a smart contract recipient
        ETHReceiver receiver = new ETHReceiver();

        vm.startPrank(proposer);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send ETH to contract",
            address(receiver),
            5 ether,
            address(0),
            0
        );

        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());

        uint256 votingTokenId = proposal.votingTokenId();
        proposal.claimVotingTokens();

        // Measure balance before any execution
        uint256 balanceBefore = address(receiver).balance;

        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), votingTokenId, 100, "");

        // Explicitly trigger early termination check after vote
        proposal.checkEarlyTermination();

        // Proposal should be executed via early termination
        if (!proposal.executed()) {
            // If not executed via early termination, continue with normal voting
            vm.stopPrank();

            vm.startPrank(voter1);
            dao.setApprovalForAll(address(proposal), true);
            proposal.claimVotingTokens();
            dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), votingTokenId, 50, "");
            vm.stopPrank();

            // Roll forward to end of election
            vm.roll(block.number + 50);
            proposal.execute();
        }
        vm.stopPrank();

        // Verify transfer succeeded to smart contract
        assertEq(address(receiver).balance - balanceBefore, 5 ether);
        assertEq(receiver.receivedAmount(), 5 ether);
    }

    function testReentrancyProtection() public {
        // Deploy attacker contract
        ReentrantAttacker attacker = new ReentrantAttacker(dao, factory);

        vm.startPrank(proposer);
        // Transfer some tokens to attacker so it can create proposals
        dao.safeTransferFrom(proposer, address(attacker), 0, 10, "");
        vm.stopPrank();

        vm.startPrank(address(attacker));
        // Have attacker create the malicious proposal
        attacker.setupAttack();
        vm.stopPrank();

        vm.startPrank(proposer);
        TreasuryProposal proposal = attacker.attackProposal();

        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());

        uint256 votingTokenId = proposal.votingTokenId();
        proposal.claimVotingTokens();
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), votingTokenId, 90, "");

        // Explicitly trigger early termination check after vote
        // This will execute and transfer ETH, triggering the attacker's receive function
        proposal.checkEarlyTermination();

        // If early termination didn't execute, continue with normal voting
        if (!proposal.executed()) {
            vm.stopPrank();

            vm.startPrank(voter1);
            dao.setApprovalForAll(address(proposal), true);
            proposal.claimVotingTokens();
            dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), votingTokenId, 50, "");
            vm.stopPrank();

            // Roll forward to end of election
            vm.roll(block.number + 50);

            // Execute - the attacker will receive ETH and try to reenter
            proposal.execute();
        }
        vm.stopPrank();

        // Verify the attack was blocked (attacked flag should be true, meaning receive was called)
        assertTrue(attacker.attacked(), "Attacker receive function should have been called");
        // Verify proposal was only executed once (if reentrancy succeeded, this would be different)
        assertTrue(proposal.executed());
    }

    function testFailETHTransferToRejectingContract() public {
        // Deploy contract that rejects ETH
        ETHRejecter rejecter = new ETHRejecter();

        vm.startPrank(proposer);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send ETH to rejecter",
            address(rejecter),
            1 ether,
            address(0),
            0
        );

        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(40);

        uint256 votingTokenId = proposal.votingTokenId();
        proposal.claimVotingTokens();
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();

        vm.startPrank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.claimVotingTokens();
        dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), votingTokenId, 50, "");
        vm.stopPrank();

        vm.roll(block.number + 50);

        // This should fail with "ETH transfer failed"
        proposal.execute();
    }

    function testETHTransferToEOA() public {
        // Test that normal EOA transfers still work
        address payable recipient = payable(address(0x999));

        vm.startPrank(proposer);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send ETH to EOA",
            recipient,
            10 ether,
            address(0),
            0
        );

        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(40);

        uint256 votingTokenId = proposal.votingTokenId();
        proposal.claimVotingTokens();

        // Measure balance before any execution
        uint256 balanceBefore = recipient.balance;

        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), votingTokenId, 100, "");

        // Explicitly trigger early termination check after vote
        proposal.checkEarlyTermination();

        // Proposal should be executed via early termination
        if (!proposal.executed()) {
            // If not executed via early termination, continue with normal voting
            vm.stopPrank();

            vm.startPrank(voter1);
            dao.setApprovalForAll(address(proposal), true);
            proposal.claimVotingTokens();
            dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), votingTokenId, 50, "");
            vm.stopPrank();

            // Roll forward to end of election
            vm.roll(block.number + 50);
            proposal.execute();
        }
        vm.stopPrank();

        // Verify normal EOA transfer still works
        assertEq(recipient.balance - balanceBefore, 10 ether);
    }
}
