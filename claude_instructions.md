# MarketDAO Claude Instructions

This document provides a comprehensive overview of the MarketDAO codebase to help Claude Code quickly understand the project and provide effective assistance.

## Project Overview

**MarketDAO** is a revolutionary governance framework that brings market forces into DAO decision-making. Unlike traditional DAOs with static voting power, MarketDAO creates tradable voting tokens for each election, allowing market mechanisms to influence governance outcomes.

**Key Innovation**: Voting rights can be bought and sold during elections, enabling those who care more about an issue to acquire more voting power.

## Technology Stack

- **Smart Contracts**: Solidity ^0.8.20, Foundry framework
- **Frontend**: React 18 + TypeScript + Vite + ethers.js v5
- **Testing**: Forge (Foundry's test suite)
- **Deployed Networks**:
  - Local (Anvil, chain ID 31337)
  - Polygon Amoy testnet (chain ID 80002)
  - Base Sepolia testnet (chain ID 84532)

## Project Structure

```
marketDAO/
├── src/                      # Smart contracts
│   ├── MarketDAO.sol         # Core DAO contract (ERC1155-based)
│   ├── Proposal.sol          # Abstract proposal base class
│   ├── ProposalTypes.sol     # Concrete proposal implementations
│   └── ProposalFactory.sol   # Factory for creating proposals (uses EIP-1167 clones)
├── script/                   # Deployment scripts
│   ├── Deploy.s.sol          # Default: Open market DAO
│   ├── Deploy.controlled.s.sol  # Controlled supply (transfer-on-purchase)
│   └── Deploy.private.s.sol  # Restricted purchases (holder-only)
├── test/                     # Comprehensive test suite (23 files, 4,337 lines)
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # UI components (Dashboard, ProposalCard, etc.)
│   │   ├── hooks/            # React hooks (useWallet, useDAO, useProposals)
│   │   ├── contexts/         # Context providers (DAOContext)
│   │   └── types/            # TypeScript types and ABIs
├── foundry.toml             # Foundry configuration
├── CLAUDE.md                # Build commands and code style guide
└── README.md                # Comprehensive project documentation
```

## Core Smart Contracts

### 1. MarketDAO.sol (748 lines)
The heart of the system - manages governance tokens, voting, treasury, and token sales.

**Key Responsibilities**:
- ERC1155 multi-token system (ID 0 = governance tokens, ID 1+ = voting tokens)
- Direct token purchase mechanism with vesting
- Treasury management (ETH, ERC20, ERC721, ERC1155)
- Fund locking for treasury proposals
- Snapshot-based voting power (O(1) scalability)
- Vesting schedule management

**Configuration Flags** (bitfield):
- `FLAG_ALLOW_MINTING` (bit 0): Whether new governance tokens can be minted
- `FLAG_RESTRICT_PURCHASES` (bit 1): Limit purchases to existing holders
- `FLAG_MINT_ON_PURCHASE` (bit 2): Mint new tokens (false) vs. transfer from DAO (true)

**Critical State Variables**:
```solidity
uint256 public tokenPrice;                    // Price per governance token in wei
uint256 public supportThreshold;              // Basis points to trigger election (e.g., 2000 = 20%)
uint256 public quorumPercentage;              // Basis points for valid election (e.g., 5100 = 51%)
uint256 public maxProposalAge;                // Blocks before proposal expires
uint256 public electionDuration;              // Voting period length in blocks
uint256 public vestingPeriod;                 // Vesting duration for purchased tokens
uint256 public totalUnvestedGovernanceTokens; // For accurate quorum calculations
```

**Key Functions**:
- `purchaseTokens()`: Buy governance tokens with ETH (with vesting)
- `vestedBalance(address)`: Get governance tokens available for voting
- `getTotalVestedSupply()`: O(1) snapshot for quorum calculations
- `lockFunds()/unlockFunds()`: Treasury fund management for proposals
- `claimVestedTokens()`: Manual vesting schedule cleanup

**Location**: src/MarketDAO.sol

### 2. Proposal.sol (289 lines)
Abstract base contract implementing the proposal lifecycle.

**Lifecycle Phases**:
1. **Creation** → Support phase → Election trigger → Voting → Execution

**Key Features**:
- Lazy voting token distribution (claim on-demand)
- Support tracking with automatic election triggering
- Early termination when >50% majority reached
- Deterministic vote address generation (YES/NO)
- Snapshot-based voting power at election start

**Key Functions**:
- `addSupport(uint256)`: Add support to trigger election
- `canTriggerElection()`: Check if threshold met
- `claimVotingTokens()`: Claim voting tokens (1:1 with vested governance tokens)
- `execute()`: Execute passed proposal after election ends
- `checkEarlyTermination()`: End election early if >50% votes reached

**Virtual Functions** (overridden by proposal types):
- `_execute()`: Type-specific execution logic
- `_lockFunds()`: Lock treasury funds when election starts
- `_unlockFunds()`: Release locked funds on failure

**Location**: src/Proposal.sol

### 3. ProposalTypes.sol (189 lines)
Concrete implementations of proposal types.

**Proposal Types**:

1. **ResolutionProposal**: Text-only governance decisions
   - No on-chain effects
   - Used for signaling and community decisions

2. **TreasuryProposal**: Transfer treasury assets
   - Supports ETH, ERC20, ERC721, ERC1155
   - Locks funds when election triggers
   - Validates sufficient available balance
   - Parameters: recipient, amount, token address, tokenId

3. **MintProposal**: Create new governance tokens
   - Mints tokens to specified recipient
   - Used for join requests (1 token to requester)
   - Requires `allowMinting()` flag enabled
   - Parameters: recipient, amount

4. **TokenPriceProposal**: Update governance token price
   - Changes the price for direct purchases
   - Parameters: newPrice (in wei)

**Location**: src/ProposalTypes.sol

### 4. ProposalFactory.sol (113 lines)
Factory for creating proposals with access control.

**Design Pattern**: Uses OpenZeppelin's Clones (EIP-1167 minimal proxy) to reduce gas costs

**Access Control**:
- Only token holders can create most proposals
- Non-holders can only create join requests (mint 1 token to self)

**Implementation Contracts** (deployed once, cloned per proposal):
- `resolutionImpl`
- `treasuryImpl`
- `mintImpl`
- `tokenPriceImpl`

**Location**: src/ProposalFactory.sol

## Key Architectural Features

### 1. Vesting System
Prevents governance attacks by locking purchased tokens for a configurable period.

**How It Works**:
- Purchased tokens vest over `vestingPeriod` blocks (e.g., 100 blocks)
- Initial distribution bypasses vesting
- Max 10 vesting schedules per address (DoS protection)
- Automatic schedule consolidation for same unlock times
- Unvested tokens cannot be used for governance or transferred

**Why**: Prevents an attacker from buying 51% and immediately controlling the DAO

**Related Code**:
- `vestedBalance()`: MarketDAO.sol:144
- `_cleanupExpiredSchedules()`: MarketDAO.sol:173
- `totalUnvestedGovernanceTokens`: MarketDAO.sol:94

### 2. Purchase Restrictions (Optional)
Limits token purchases to existing holders to prevent hostile takeovers.

**Modes**:
- **Open Mode** (default): Anyone can purchase tokens
- **Restricted Mode**: Only existing holders (balance > 0) can purchase
- **Join Request System**: Non-holders submit mint proposals for 1 token

**Configuration**: Set `RESTRICT_PURCHASES = true` in deployment script

**Use Cases**: Investment clubs, private DAOs, security-focused governance

**Related Code**:
- `restrictPurchasesToHolders()`: MarketDAO.sol:38
- `purchaseTokens()`: MarketDAO.sol:215
- Join request validation: ProposalFactory.sol:69-76

### 3. Snapshot-Based Voting (O(1) Scalability)
Enables unlimited number of token holders without gas limit concerns.

**How It Works**:
- Uses `getTotalVestedSupply()` instead of iterating holders
- Voting power frozen at election start
- Quorum calculated from vested supply only

**Performance**:
- Tested with 10,000+ holders
- Constant ~280K gas for election triggering
- No holder count limits

**Related Code**:
- `getTotalVestedSupply()`: MarketDAO.sol:603
- `_triggerElection()`: Proposal.sol:127
- `snapshotTotalVotes`: Proposal.sol:164

### 4. Lazy Voting Token Distribution
Minimizes gas costs by distributing voting tokens on-demand.

**How It Works**:
- Voting tokens NOT minted when election starts
- Each holder claims their voting tokens when ready to participate
- One-time claim per address per election
- Amount = vested governance token balance at election start

**Why**: Proposer doesn't pay gas to mint tokens for all holders

**Related Code**:
- `claimVotingTokens()`: Proposal.sol:182
- `hasClaimed` mapping: Proposal.sol:27
- `getClaimableAmount()`: Proposal.sol:196

### 5. Early Election Termination
Elections can end early when a clear majority is reached.

**Trigger Condition**: >50% of total possible votes cast for YES or NO

**How It Works**:
- Called automatically after each vote (MarketDAO.sol:413)
- Can be called manually by anyone
- Immediate execution on majority YES
- Immediate failure on majority NO

**Related Code**:
- `checkEarlyTermination()`: Proposal.sol:203
- Auto-call in `safeTransferFrom()`: MarketDAO.sol:413

### 6. Fund Locking for Treasury Proposals
Prevents multiple proposals from using the same funds.

**How It Works**:
- Funds locked when election triggers
- Funds released when proposal executes or fails
- Available balance = total balance - locked amounts
- Validation ensures sufficient available funds

**Limitation**: Gas cost scales with number of concurrent treasury proposals

**Related Code**:
- `lockFunds()/unlockFunds()`: MarketDAO.sol:285, 333
- `getAvailableETH()`: MarketDAO.sol:665
- `lockedFunds` tracking: MarketDAO.sol:72-74

## Frontend Architecture

### Technology
- React 18 with TypeScript
- Vite for build tooling
- ethers.js v5 for blockchain interaction
- No external UI libraries (custom components)

### Key Components

**Dashboard.tsx**: Main view showing token info, treasury balance, vesting status

**ProposalList.tsx**: Displays proposals with filtering (Active/Elections/History)

**ProposalCard.tsx**: Individual proposal with status badges and actions

**CreateProposal.tsx**: Multi-type proposal creation form

**Members.tsx**: Token holder list with balances

**DAOSelector.tsx**: Switch between different DAO instances

### Key Hooks

**useWallet.ts**:
- Wallet connection and contract initialization
- ethers.js provider/signer management
- Contract instance creation

**useDAO.ts**:
- DAO state (balances, config, treasury)
- Token purchase functionality
- Vesting status tracking

**useProposals.ts**:
- Proposal loading with caching
- Proposal creation (all types)
- Support/trigger/vote actions
- Vote claiming

### Context

**DAOContext.tsx**:
- Global DAO address management
- Recent DAOs list (localStorage)
- URL parameter support (?dao=...&factory=...)
- Default addresses for local deployment

**Default Addresses** (localhost):
- DAO: `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- Factory: `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853`

### State Management
- React Context for global DAO address
- Local state in hooks for proposal lists
- localStorage for recent DAOs and join request tracking
- URL parameters for shareable DAO links

## Testing

### Test Suite Overview
- **23 test files**, 4,337 total lines of test code
- Comprehensive coverage of functionality, security, edge cases, and scalability
- Uses Foundry's testing framework (Forge)

### Test Categories

**Basic Functionality**:
- `MarketDAO.t.sol`: Initial state, token distribution
- `Proposal.t.sol`: Proposal lifecycle basics
- `TokenSale.t.sol`: Token purchase mechanics

**Proposal Types**:
- `ETHTransfer.t.sol`: Treasury ETH transfers
- `TokenPriceProposal.t.sol`: Price updates
- `MultipleProposalTest.t.sol`: Concurrent proposals

**Voting & Elections**:
- `VotingPeriod.t.sol`: Election timing
- `VotingEnforcement.t.sol`: Vote validation
- `EarlyTermination.t.sol`: Early election completion

**Vesting System**:
- `Vesting.t.sol`: Basic vesting functionality
- `VestedSupplyTracking.t.sol`: Unvested token counter accuracy
- `VestingAutoCleanup.t.sol`: Automatic schedule cleanup
- `FundLocking.t.sol`: Treasury fund locking

**Access Control & Security**:
- `PurchaseRestrictions.t.sol`: Purchase modes
- `MintOnPurchase.t.sol`: Mint vs. transfer modes
- `FactoryValidation.t.sol`: Factory security
- `JoinRequest.t.sol`: Join request validation
- `VoteAddressCollision.t.sol`: Vote address security

**Scalability**:
- `HolderScaling.t.sol`: Tests with 10 to 10,000 holders
  - Demonstrates O(1) gas costs regardless of holder count

**Edge Cases**:
- `ProposalExpiration.t.sol`: Expiration mechanics
- `CanTriggerElectionExpiration.t.sol`: Threshold edge cases

### Running Tests

```bash
# Run all tests
forge test

# Run specific test
forge test --match-test testFunctionName

# Run tests in specific file
forge test --match-path test/FileName.t.sol

# Run with verbosity
forge test -vvv
```

## Deployment

### Deployment Scripts

**Deploy.s.sol** (Default - Open Market DAO):
```solidity
ALLOW_MINTING = true
RESTRICT_PURCHASES = false
MINT_ON_PURCHASE = false  // Mints new tokens
TOKEN_PRICE = 0.0001 ETH
VESTING_PERIOD = 100 blocks
```

**Deploy.controlled.s.sol** (Controlled Supply):
```solidity
MINT_ON_PURCHASE = true  // Transfers from DAO treasury
```

**Deploy.private.s.sol** (Restricted/Private DAO):
```solidity
RESTRICT_PURCHASES = true  // Only holders can purchase
```

### Deployment Commands

```bash
# Local deployment
./deploy.sh
# or
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Testnet deployment (Polygon Amoy example)
forge script script/Deploy.s.sol \
  --rpc-url https://rpc-amoy.polygon.technology \
  --account amoy \
  --broadcast
```

### Configuration Parameters

All DAOs are configured with these defaults:
- **Support Threshold**: 20% (2000 basis points)
- **Quorum**: 51% (5100 basis points)
- **Max Proposal Age**: 100 blocks
- **Election Duration**: 50 blocks
- **Token Price**: 0.0001 ETH (1e14 wei)
- **Vesting Period**: 100 blocks
- **Initial Distribution**: 100 tokens to deployer

**Note**: Basis points allow 0.01% precision (10000 = 100%)

## Common Development Tasks

### Building and Testing

```bash
# Build contracts
forge build

# Run all tests
forge test

# Format code
forge fmt

# Deploy locally
./deploy.sh
```

### Creating Proposals (Frontend)

1. **Resolution**: Text-only governance decision
2. **Treasury**: Transfer ETH/tokens from treasury
3. **Mint**: Create new governance tokens
4. **Token Price**: Update token purchase price
5. **Join Request**: Non-holders request 1 token

### Debugging Common Issues

**"Insufficient vested governance tokens"**:
- Tokens are still vesting
- Call `claimVestedTokens()` first
- Check `vestedBalance()` vs `balanceOf()`

**"Only existing holders can purchase"**:
- DAO has `RESTRICT_PURCHASES = true`
- Non-holders must submit join request
- Use mint proposal for 1 token

**"Proposal expired"**:
- Proposal older than `maxProposalAge` blocks
- Support must be added before expiration
- Election must trigger before expiration

**"Quorum not met"**:
- Not enough votes cast (< 51% of vested supply)
- Encourage more holders to claim and vote

## Security Features

### Implemented Protections

✅ **Reentrancy Protection**: `nonReentrant` modifier on transfer functions
✅ **Factory-Only Registration**: Only ProposalFactory can register proposals
✅ **Token Holder Restrictions**: Only vested token holders create proposals
✅ **Safe Token Transfers**: SafeERC20 and safeTransferFrom throughout
✅ **Bounded Gas Costs**: All operations have predictable gas limits
✅ **Vote Address Collision Prevention**: Multiple entropy sources
✅ **Vesting Schedule Limits**: Max 10 schedules per address

### Known Limitations (Design Decisions)

1. **Purchase Restrictions Are Permanent**: Cannot be changed after deployment
2. **Treasury Proposal Competition**: Multiple proposals can request same funds
3. **Support Tracking After Transfers**: Support not recalculated after token transfers
4. **Fund Locking Gas Costs**: Scale linearly with concurrent treasury proposals

See README.md for detailed explanations and rationale.

## Code Style Guidelines

### Solidity Conventions
- **Version**: `pragma solidity ^0.8.20`
- **Imports**: External libraries first, then internal
- **Naming**:
  - Contracts: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPER_CASE
- **Comments**: NatSpec format
- **Error Handling**: Custom error types (not revert strings)
- **Function Order**: By visibility (external, public, internal, private)
- **Security**: Follow CEI pattern (Checks-Effects-Interactions)

### Test Conventions
- Test function names: `testFunctionName`
- Group related tests in same contract
- Use descriptive names explaining what's being tested

## Important Files to Reference

### Documentation
- `README.md`: Comprehensive project documentation (275 lines)
- `CLAUDE.md`: Build commands and code style guide
- `DEPLOYMENT.md`: Detailed deployment guide (184 lines)

### Configuration
- `foundry.toml`: Foundry configuration (optimizer settings)
- `frontend/src/contexts/DAOContext.tsx`: Default addresses

### Core Contracts (by importance)
1. `src/MarketDAO.sol` (748 lines)
2. `src/Proposal.sol` (289 lines)
3. `src/ProposalTypes.sol` (189 lines)
4. `src/ProposalFactory.sol` (113 lines)

### Key Frontend Files
- `frontend/src/hooks/useProposals.ts` (516 lines) - Proposal management
- `frontend/src/hooks/useWallet.ts` - Wallet connection
- `frontend/src/contexts/DAOContext.tsx` (94 lines) - DAO address management

## Git Status Summary

Recent commits show:
- Implementation of sell-only-minted-tokens option (FLAG_MINT_ON_PURCHASE)
- Removal of failing tests
- Proxy pattern implementation for ProposalFactory
- Restricted purchase deployment script additions
- Frontend fixes for restricted purchases

Current uncommitted changes:
- Deleted: claude_instructions.md (being recreated)
- Deleted: frontend/dist files (build artifacts)
- Modified: ProposalCard.tsx, DAOContext.tsx, useProposals.ts

## Quick Reference: Key Concepts

**Governance Token (ID 0)**: ERC1155 token used for creating proposals and claiming voting tokens

**Voting Token (ID 1+)**: Temporary ERC1155 tokens created per election, tradable, used for voting

**Vested Balance**: Governance tokens available for governance (excludes unvested purchased tokens)

**Support**: Tokens committed to a proposal to trigger an election (20% threshold default)

**Quorum**: Minimum votes required for valid election (51% of vested supply default)

**Basis Points**: Percentage precision (10000 = 100%, allowing 0.01% granularity)

**Election Lifecycle**: Support → Threshold → Election → Voting → Execution

**Vote Addresses**: Deterministic addresses generated for YES/NO voting per proposal

**Join Request**: Mint proposal for 1 token created by non-holder to join DAO

## Development Workflow

### Making Smart Contract Changes

1. Edit contracts in `src/`
2. Run `forge build` to compile
3. Run `forge test` to verify tests pass
4. Run `forge fmt` to format code
5. Add tests if adding new functionality
6. Update documentation if changing behavior

### Making Frontend Changes

1. Edit files in `frontend/src/`
2. Frontend dev server auto-reloads (if running `npm run dev`)
3. Test with local blockchain (Anvil)
4. Verify contract interactions work correctly

### Deploying Changes

1. Update deployment script if needed
2. Deploy to local testnet first: `./deploy.sh`
3. Test thoroughly with frontend
4. Deploy to public testnet when ready
5. Update frontend default addresses if changed

## Common Gotchas

1. **Vesting**: Purchased tokens can't be used immediately - must wait for vesting period
2. **Support vs Voting**: Support triggers elections, voting happens during elections
3. **Lazy Distribution**: Voters must claim tokens before voting
4. **Basis Points**: Remember 2000 = 20%, not 2000%
5. **Flag Bitfield**: Use helper functions (allowMinting(), etc.) not direct flag checks
6. **Proposal Types**: Different ABIs for different proposal types - frontend must detect type
7. **Fund Locking**: Treasury proposals lock funds when election starts, not at creation

## Future Development Possibilities

From README.md:
- Resolution enhancements (expiring resolutions, cancellation proposals)
- Multiple choice proposals beyond binary YES/NO
- Variable election lengths
- Staking mechanisms for proposals

## Summary

MarketDAO is a production-ready, well-tested governance framework that innovates on traditional DAOs by making voting rights tradable. The codebase demonstrates:

- **Strong Architecture**: Clean separation of concerns
- **Gas Optimization**: Proxy pattern, O(1) snapshots
- **Security Focus**: Multiple protection layers
- **Flexibility**: Configurable for different use cases
- **Scalability**: Proven to handle 10,000+ holders
- **User Experience**: Full-featured React frontend

When working with this codebase, always consider:
1. Vesting implications for purchased tokens
2. Gas costs and scalability
3. Security implications of changes
4. Both open and restricted purchase modes
5. Test coverage for new features
