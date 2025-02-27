# MarketDAO Frontend

A simple web interface for interacting with the MarketDAO smart contracts.

## Features

- View DAO information (name, token price, etc.)
- Purchase governance tokens
- Create different types of proposals:
  - Resolution proposals
  - Treasury transfer proposals
  - Token minting proposals
  - Token price change proposals
- Support proposals with your governance tokens
- Vote on active proposals
- Execute successful proposals

## Setup

1. Deploy the MarketDAO contracts using Foundry:
   ```
   ./deploy.sh
   ```

2. Update the contract addresses in `app.js` with your deployed contract addresses.

3. Serve the frontend locally using a simple HTTP server. For example:
   ```
   cd front-end
   python -m http.server
   ```

4. Access the frontend at http://localhost:8000

## Contract Interaction

This frontend interacts with the following smart contracts:
- `MarketDAO.sol` - Main DAO contract
- `ProposalFactory.sol` - Factory for creating various types of proposals
- `Proposal.sol` - Base proposal contract
- `ProposalTypes.sol` - Implementation of different proposal types

## Requirements

- MetaMask or another Web3-compatible browser extension
- Ethereum development environment (Anvil, Hardhat, etc.)