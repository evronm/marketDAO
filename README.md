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
- Each election creates unique voting tokens distributed to governance token holders
- Voting is done by transferring voting tokens to YES/NO addresses
- Treasury functions support multiple asset types (ETH, ERC20, ERC721, ERC1155)

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
- Initial token distribution (addresses and amounts)

## Current Deployment

- **Frontend**: [https://evronm.github.io/marketDAO/index.html](https://evronm.github.io/marketDAO/index.html)
- **DAO Contract**: 0xf188d689d78b58b9d3e1a841a9b9afb8f92ddf55 (Polygon Amoy testnet)
- **Factory Contract**: 0xc609fa60239116ecee53af12f733eb0214d7b1ad (Polygon Amoy testnet)

## Usage Flow

1. **Create a Proposal**: Governance token holders can submit proposals
2. **Support Phase**: Proposals need to reach support threshold to trigger an election
3. **Election**: When triggered, voting tokens are distributed 1:1 to governance token holders
4. **Trading Period**: During elections, voting tokens can be freely bought and sold
5. **Voting**: Cast votes by sending voting tokens to YES/NO addresses
6. **Execution**: Successful proposals are executed automatically

## Future Possibilities

- Resolution enhancements: Expiring resolutions, cancellation proposals
- Multiple choice proposals beyond binary YES/NO
- Variable election lengths
- Staking mechanisms for proposals

## License

MIT