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
- **Proposal lifecycle** with support thresholds and voting periods
- **Multiple proposal types**:
  - Resolution proposals (text-only governance decisions)
  - Treasury transfers (ETH, ERC20, ERC721, ERC1155)
  - Governance token minting
  - Token price updates
- **Early election termination** when clear majority is reached
- **Configurable parameters** for tailoring governance to specific needs

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
- **Vesting schedule**: Each token purchase creates a separate vesting entry
- **Multiple purchases**: Each purchase has its own unlock block, allowing gradual vesting
- **Frontend display**: Dashboard shows total, vested, and unvested balances separately

Initial token holders (from constructor) are not subject to vesting restrictions.

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
- Name of the DAO
- Support threshold (% tokens needed to trigger an election)
- Quorum percentage (% tokens needed for valid election)
- Maximum proposal age before expiration
- Election duration (in blocks)
- Treasury configuration (ETH, ERC20, ERC721, ERC1155)
- Governance token minting permissions
- Initial token price (0 = direct sales disabled)
- **Vesting period** (in blocks, 0 = no vesting)
- Initial token distribution (addresses and amounts)

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