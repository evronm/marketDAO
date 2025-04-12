# MarketDAO Development Guide

## Build & Test Commands
- Build the project: `forge build`
- Run all tests: `forge test`
- Run a single test: `forge test --match-test testFunctionName`
- Run tests in a specific file: `forge test --match-path test/FileName.t.sol`
- Format code: `forge fmt`
- Deploy local: `./deploy.sh` or `forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast`

## Code Style Guidelines
- **Solidity Version**: Use pragma ^0.8.20
- **Imports**: Group imports by category (external libraries first, then internal imports)
- **Naming**: 
  - Contracts: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPER_CASE
- **Comments**: Use NatSpec format for contract and function documentation
- **Error Handling**: Use custom error types rather than revert strings
- **Function Order**: visibility (external, public, internal, private), then alphabetical
- **Security**: No hardcoded secrets, validate all inputs, follow CEI pattern
- **Tests**: Name tests with "test" prefix, group related tests in the same contract

- The entire front end is in index.html in the base directory
- For CDN, use jsdeliver
