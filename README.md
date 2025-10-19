# MarketDAO

MarketDAO is a governance framework that brings market forces to bear on group decisions. The key innovation is a system where voting rights can be freely bought and sold during elections, allowing market forces to influence governance outcomes.

## Core Concept

Unlike traditional DAOs where voting power is static, MarketDAO introduces tradable voting tokens for each election. This creates a dynamic where voters can:
- Buy more voting power if they feel strongly about an issue
- Sell their voting power if others value it more
- Speculate on election outcomes through voting token markets

## Features

- **ERC1155-based governance tokens** for proposal creation and voting rights
- **Saleable voting rights** through transferable voting tokens
- **Lazy token distribution** for gas-efficient voting token claiming
- **Token vesting mechanism** to prevent governance attacks from new token purchases
- **Snapshot-based voting power** for unlimited scalability (no holder count limits)
- **Automatic vesting schedule management** with cleanup and consolidation
- **Proposal lifecycle** with support thresholds and voting periods
- **Multiple proposal types**:
  - Resolution proposals (text-only governance decisions)
  - Treasury transfers (ETH, ERC20, ERC721, ERC1155)
  - Governance token minting
  - Token price updates
- **Early election termination** when clear majority is reached
- **Configurable parameters** for tailoring governance to specific needs
- **Security-hardened** with factory-based proposal registration and bounded gas costs

## Implementation Details

- The DAO inherits from OpenZeppelin's ERC1155 implementation
- Token ID 0 is reserved for governance tokens
- Each election creates unique voting tokens that can be claimed by governance token holders
- Voting is done by transferring voting tokens to YES/NO addresses
- Treasury functions support multiple asset types (ETH, ERC20, ERC721, ERC1155)

### Lazy Token Distribution

To minimize gas costs when elections are triggered, voting tokens use a "lazy minting" approach:

- **On-demand claiming**: Voting tokens are not automatically distributed when an election starts
- **Gas efficiency**: The proposer who triggers the election doesn't pay gas fees to mint tokens for all holders
- **User-initiated**: Each governance token holder claims their voting tokens when they're ready to participate
- **One-time claim**: Each address can claim once per election, receiving voting tokens equal to their vested governance token balance
- **Flexible participation**: Holders can claim and vote at any point during the election period

### Token Vesting System

To prevent governance attacks where an actor purchases enough tokens to immediately control the DAO, purchased tokens are subject to a vesting period:

- **Vested tokens**: Available for governance (creating/supporting proposals, receiving voting tokens)
- **Unvested tokens**: Locked for governance but transferable
- **Automatic cleanup**: Expired vesting schedules are automatically removed during user interactions
- **Schedule consolidation**: Multiple purchases with the same unlock time are automatically merged
- **Schedule limit**: Maximum 10 active vesting schedules per address (prevents DoS attacks)
- **Manual cleanup**: Users can call `cleanupMyVestingSchedules()` to remove expired schedules
- **Frontend display**: Dashboard shows total, vested, and unvested balances separately

Initial token holders (from constructor) are not subject to vesting restrictions.

### Snapshot-Based Voting Power

To enable unlimited scalability without gas limit concerns:

- **One-time snapshot**: Total voting power is calculated once when an election is triggered
- **O(1) execution cost**: Proposal execution and early termination use the snapshot (no loops)
- **Unlimited holders**: DAO can scale to thousands of governance token holders
- **Fair voting**: Voting power is frozen at election start, preventing mid-election manipulation
- **Gas efficient**: Saves millions of gas compared to dynamic calculations

## Security & Scalability

MarketDAO has been audited and hardened against common vulnerabilities:

### Security Features
- ✅ **Factory-only proposal registration**: Only the official ProposalFactory can register proposals
- ✅ **Safe token transfers**: Uses OpenZeppelin's SafeERC20 and safeTransferFrom for all token operations
- ✅ **Basis points precision**: Thresholds use basis points (10000 = 100%) for 0.01% precision
- ✅ **ReentrancyGuard**: Protected against reentrancy attacks on critical functions
- ✅ **Bounded gas costs**: All operations have predictable, capped gas costs

### Scalability Guarantees
- ✅ **Unlimited governance token holders**: Snapshot mechanism enables thousands of participants
- ✅ **Automatic vesting cleanup**: Prevents unbounded array growth in vesting schedules
- ✅ **O(1) proposal execution**: Constant-time execution regardless of holder count
- ✅ **Gas-efficient operations**: Optimized for low transaction costs

### DoS Protection
- ✅ **No holder count limits**: Snapshot prevents DoS from too many token holders
- ✅ **Vesting schedule limits**: Max 10 active schedules per address with auto-cleanup
- ✅ **Consolidation**: Automatic merging of schedules with same unlock time

## Installation & Development

```bash
# Clone the repository
git clone https://github.com/evronm/marketDAO
cd marketDAO

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Format code
forge fmt

# Deploy locally
./deploy.sh
```

## Configuration Parameters

When creating a new DAO, you can configure:
- **Name** of the DAO
- **Support threshold** (in basis points, e.g., 2000 = 20% of tokens needed to trigger an election)
- **Quorum percentage** (in basis points, e.g., 5100 = 51% of tokens needed for valid election)
- **Maximum proposal age** before expiration (in blocks)
- **Election duration** (in blocks)
- **Treasury configuration** (ETH, ERC20, ERC721, ERC1155)
- **Governance token minting** permissions (true/false)
- **Initial token price** (in wei, 0 = direct sales disabled)
- **Vesting period** (in blocks, 0 = no vesting)
- **Initial token distribution** (addresses and amounts)

**Note on Basis Points**: All percentage parameters use basis points for precision:
- 10000 = 100%
- 5100 = 51%
- 2000 = 20%
- 250 = 2.5%

This allows for fractional percentages with 0.01% precision.

## Current Deployment

- **Frontend**: [https://evronm.github.io/marketDAO/index.html](https://evronm.github.io/marketDAO/index.html)
- **DAO Contract**: 0xf188d689d78b58b9d3e1a841a9b9afb8f92ddf55 (Polygon Amoy testnet)
- **Factory Contract**: 0xc609fa60239116ecee53af12f733eb0214d7b1ad (Polygon Amoy testnet)

## Usage Flow

1. **Create a Proposal**: Governance token holders can submit proposals
2. **Support Phase**: Proposals need to reach support threshold to trigger an election
3. **Election Triggered**: When the threshold is reached, an election period begins
4. **Claim Voting Tokens**: Governance token holders claim their voting tokens (1:1 with vested governance tokens)
5. **Trading Period**: During elections, voting tokens can be freely bought and sold
6. **Voting**: Cast votes by sending voting tokens to YES/NO addresses
7. **Execution**: Successful proposals are executed automatically

## Future Possibilities

- Resolution enhancements: Expiring resolutions, cancellation proposals
- Multiple choice proposals beyond binary YES/NO
- Variable election lengths
- Staking mechanisms for proposals

## License

MIT