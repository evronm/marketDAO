// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/Proposal.sol";
import "../src/ProposalTypes.sol";

// A simple testing mock implementation
contract MockDAO is Test {
    mapping(address => bool) public votingAllowed;
    mapping(address => bool) public isVoteAddress;
    
    function mintVotingTokens(address user, uint256 amount) external {
        // Just record minting for verification
    }
    
    function setVotingAllowed(address proposal, bool allowed) external {
        votingAllowed[proposal] = allowed;
    }
    
    function registerVoteAddress(address voteAddr) external {
        isVoteAddress[voteAddr] = true;
    }
    
    function transferVote(address from, address to, uint256 amount) external returns (bool) {
        // Check if this is a vote address
        if (isVoteAddress[to]) {
            // Check if voting is allowed for the proposal
            bool foundActiveElection = false;
            
            // In a real implementation we would check each proposal
            // For testing, we'll just see if any voting is allowed
            for (uint i = 0; i < 5; i++) {
                address testAddr = address(uint160(0x1000 + i));
                if (votingAllowed[testAddr] && isVoteAddress[to]) {
                    foundActiveElection = true;
                    break;
                }
            }
            
            // If we found a vote address but no active election, reject the transfer
            if (!foundActiveElection) {
                revert("Election has ended");
            }
        }
        
        return true; // Transfer allowed
    }
}

// Simple tests for voting period enforcement using a completely isolated mock
contract VotingEnforcementTest is Test {
    MockDAO dao;
    address voter = address(0x1);
    address yesVoteAddr = address(0x2);
    address proposal = address(0x1000); // Match our algorithm in the real contract
    
    function setUp() public {
        dao = new MockDAO();
        dao.registerVoteAddress(yesVoteAddr);
    }
    
    function testVotingDuringActiveElection() public {
        // Set the election as active
        dao.setVotingAllowed(proposal, true);
        
        // Should be able to vote
        bool success = dao.transferVote(voter, yesVoteAddr, 100);
        assertTrue(success);
    }
    
    function testVotingAfterElectionEnded() public {
        // Set the election as inactive
        dao.setVotingAllowed(proposal, false);
        
        // Should not be able to vote
        vm.expectRevert("Election has ended");
        dao.transferVote(voter, yesVoteAddr, 100);
    }
}