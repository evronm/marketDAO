# MarketDAO Frontend

## Overview

MarketDAO is a governance system with tradeable voting tokens (ERC-1155). This frontend interacts with the MarketDAO smart contracts to enable proposal creation, support gathering, elections, and voting.

**Recent Backend Change**: The contract architecture was simplified. Instead of separate proposal types (Resolution, Treasury, Mint, Parameter), there's now a single unified `Proposal` contract that can execute arbitrary calldata. `DistributionProposal` remains separate due to its unique lifecycle (registration/redemption phases).

## Tech Stack

**Framework**: VanJS (https://vanjs.org)
- ~1KB reactive UI library
- No build step required
- No JSX, no virtual DOM
- Works with vanilla JS and CDN imports

**Why VanJS over React**:
- Philosophical alignment with simplicity
- No Vite/webpack/bundler complexity
- Can be served as static files
- Readable, debuggable source in browser

**Styling**: Bootstrap 5 via CDN
- The old frontend used Bootstrap classes extensively
- Keep this for rapid development

**Web3**: ethers.js v6 via CDN
- Note: Old frontend used ethers v5
- v6 has breaking changes (see migration notes below)

## Project Structure

```
frontend/
├── index.html          # Entry point, CDN imports
├── css/
│   └── styles.css      # Custom styles (minimal, Bootstrap handles most)
├── js/
│   ├── app.js          # Main app, routing, state
│   ├── components/
│   │   ├── Dashboard.js
│   │   ├── ProposalList.js
│   │   ├── ProposalCard.js
│   │   ├── CreateProposal.js
│   │   ├── Elections.js
│   │   └── Members.js
│   ├── services/
│   │   ├── wallet.js       # MetaMask connection
│   │   ├── dao.js          # DAO contract interactions
│   │   ├── proposals.js    # Proposal contract interactions
│   │   └── calldata.js     # Encode/decode proposal calldata
│   ├── utils/
│   │   ├── formatting.js   # Address truncation, ETH formatting
│   │   └── notifications.js
│   └── abis/
│       ├── MarketDAO.json
│       ├── Proposal.json
│       ├── DistributionProposal.json
│       └── ProposalFactory.json
└── CLAUDE.md
```

## VanJS Patterns

### Basic Component
```javascript
import van from "vanjs-core"
const { div, h1, button, p } = van.tags

const Counter = () => {
      const count = van.state(0)
        return div(
            h1("Counter"),
                p(() => `Count: ${count.val}`),
                    button({ onclick: () => count.val++ }, "Increment")
                      )
}
```

### Reactive State
```javascript
const wallet = van.state(null)
const daoInfo = van.state(null)
const proposals = van.state([])

// Derived state
const isConnected = van.derive(() => wallet.val !== null)
const vestedBalance = van.derive(() => daoInfo.val?.vestedBalance ?? "0")
```

### Conditional Rendering
```javascript
const Content = () => {
      return div(
          () => isConnected.val 
                ? Dashboard({ daoInfo }) 
                      : ConnectWallet({ onConnect })
                        )
}
```

### Lists
```javascript
const ProposalList = ({ proposals }) => {
      return div(
          () => proposals.val.map(p => ProposalCard({ proposal: p }))
            )
}
```

## Ethers v6 Migration Notes

The old frontend used ethers v5. Key changes in v6:

```javascript
// v5 → v6

// Provider
new ethers.providers.Web3Provider(window.ethereum)
→ new ethers.BrowserProvider(window.ethereum)

// Get signer
provider.getSigner()
→ await provider.getSigner()

// Parse ether
ethers.utils.parseEther("1.0")
→ ethers.parseEther("1.0")

// Format ether  
ethers.utils.formatEther(wei)
→ ethers.formatEther(wei)

// Constants
ethers.constants.AddressZero
→ ethers.ZeroAddress

// BigNumber (now native BigInt)
ethers.BigNumber.from(x)
→ BigInt(x)

// Contract calls return BigInt, not BigNumber
const balance = await contract.balanceOf(addr)  // BigInt
```

## Unified Proposal Architecture

### Old Model (Deprecated)
```
ProposalFactory.createResolutionProposal(description)
ProposalFactory.createTreasuryProposal(description, recipient, amount, token, tokenId)
ProposalFactory.createMintProposal(description, recipient, amount)
ProposalFactory.createParameterProposal(description, paramType, value)
```

### New Model
```
ProposalFactory.createProposal(description, targets[], values[], calldatas[])
```

The frontend builds calldata for what the user wants to do:

```javascript
// Example: Transfer ETH from treasury
const iface = new ethers.Interface(MarketDAO_ABI)
const calldata = iface.encodeFunctionData("transferETH", [recipient, amount])
await factory.createProposal(
  "Transfer 1 ETH to Alice",
    [daoAddress],      // targets
      [0n],              // values (ETH sent with call)
        [calldata]         // calldatas
        )

// Example: Change support threshold
const calldata = iface.encodeFunctionData("setSupportThreshold", [newThreshold])
await factory.createProposal(
  "Lower support threshold to 10%",
    [daoAddress],
      [0n],
        [calldata]
        )

// Example: Mint tokens
const calldata = iface.encodeFunctionData("mint", [recipient, amount])
await factory.createProposal(
  "Mint 100 tokens to Bob",
    [daoAddress],
      [0n],
        [calldata]
        )
```

### Decoding Proposals for Display

When displaying proposals, decode the calldata to show human-readable info:

```javascript
const decodeProposal = (targets, values, calldatas) => {
      const results = []
        const daoIface = new ethers.Interface(MarketDAO_ABI)
          
            for (let i = 0; i < targets.length; i++) {
                    try {
                              const parsed = daoIface.parseTransaction({ data: calldatas[i] })
                                    results.push({
                                                target: targets[i],
                                                        value: values[i],
                                                                function: parsed.name,
                                                                        args: parsed.args
                                                                              })
                                        } catch {
                                                  // Unknown function - show raw
                                                        results.push({
                                                                    target: targets[i],
                                                                            value: values[i],
                                                                                    function: "unknown",
                                                                                            calldata: calldatas[i]
                                                                                                  })
                                                            }
                                                              }
                                                                return results
}
```

### DistributionProposal (Special Case)

Distribution proposals have a unique lifecycle and remain a separate contract type:

1. Proposal created with `createDistributionProposal(description, token, tokenId, amountPerToken)`
2. During election, token holders call `registerForDistribution()`
3. If approved, a `DistributionRedemption` contract is deployed
4. Registered holders call `claim()` on the redemption contract

## Contract ABIs (Updated)

### MarketDAO.sol
```javascript
const MarketDAO_ABI = [
  // Token operations
    "function name() view returns (string)",
      "function balanceOf(address account, uint256 id) view returns (uint256)",
        "function totalSupply(uint256 id) view returns (uint256)",
          "function vestedBalance(address holder) view returns (uint256)",
            "function hasClaimableVesting(address holder) view returns (bool)",
              "function claimVestedTokens()",
                "function purchaseTokens() payable",
                  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
                    "function getGovernanceTokenHolders() view returns (address[])",
                      
                        // Parameters (read)
                          "function tokenPrice() view returns (uint256)",
                            "function quorumPercentage() view returns (uint256)",
                              "function supportThreshold() view returns (uint256)",
                                "function vestingPeriod() view returns (uint256)",
                                  "function maxProposalAge() view returns (uint256)",
                                    "function electionDuration() view returns (uint256)",
                                      "function restrictPurchasesToHolders() view returns (bool)",
                                        "function allowMinting() view returns (bool)",
                                          "function mintToPurchase() view returns (bool)",
                                            "function getAvailableTokensForPurchase() view returns (uint256)",
                                              
                                                // Execution (called by proposals)
                                                  "function executeCall(address target, uint256 value, bytes calldata data) returns (bytes)",
                                                    
                                                      // Parameter setters (for calldata encoding)
                                                        "function setSupportThreshold(uint256 newThreshold)",
                                                          "function setQuorumPercentage(uint256 newQuorum)",
                                                            "function setMaxProposalAge(uint256 newAge)",
                                                              "function setElectionDuration(uint256 newDuration)",
                                                                "function setVestingPeriod(uint256 newPeriod)",
                                                                  "function setTokenPrice(uint256 newPrice)",
                                                                    "function setFlags(uint256 newFlags)",
                                                                      
                                                                        // Treasury operations (for calldata encoding)
                                                                          "function transferETH(address recipient, uint256 amount)",
                                                                            "function transferERC20(address token, address recipient, uint256 amount)",
                                                                              "function transferERC721(address token, address recipient, uint256 tokenId)",
                                                                                "function transferERC1155(address token, address recipient, uint256 tokenId, uint256 amount)",
                                                                                  
                                                                                    // Minting (for calldata encoding)
                                                                                      "function mint(address recipient, uint256 amount)"
                                                                                      ]
                                                                                      ```

### Proposal.sol (Unified)
```javascript
const Proposal_ABI = [
  "function description() view returns (string)",
    "function proposer() view returns (address)",
      "function createdAt() view returns (uint256)",
        "function supportTotal() view returns (uint256)",
          "function electionTriggered() view returns (bool)",
            "function executed() view returns (bool)",
              "function electionStart() view returns (uint256)",
                "function votingTokenId() view returns (uint256)",
                  "function yesVoteAddress() view returns (address)",
                    "function noVoteAddress() view returns (address)",
                      "function canTriggerElection() view returns (bool)",
                        "function dao() view returns (address)",
                          
                            // New: arbitrary execution
                              "function targets(uint256 index) view returns (address)",
                                "function values(uint256 index) view returns (uint256)",
                                  "function calldatas(uint256 index) view returns (bytes)",
                                    "function getActions() view returns (address[] targets, uint256[] values, bytes[] calldatas)",
                                      
                                        // Voting
                                          "function getClaimableAmount(address holder) view returns (uint256)",
                                            "function hasClaimed(address holder) view returns (bool)",
                                              "function addSupport(uint256 amount)",
                                                "function removeSupport(uint256 amount)",
                                                  "function claimVotingTokens()"
                                                  ]
                                                  ```

### ProposalFactory.sol
```javascript
const ProposalFactory_ABI = [
  "function proposalCount() view returns (uint256)",
    "function proposals(uint256 index) view returns (address)",
      
        // Unified creation
          "function createProposal(string description, address[] targets, uint256[] values, bytes[] calldatas) returns (address)",
            
              // Distribution (separate)
                "function createDistributionProposal(string description, address token, uint256 tokenId, uint256 amountPerToken) returns (address)"
                ]
                ```

## Frontend Proposal Templates

The frontend provides user-friendly forms that build calldata behind the scenes:

### Template: Resolution (No Action)
```javascript
// Just a statement, no execution
await factory.createProposal(description, [], [], [])
```

### Template: Transfer ETH
```javascript
const calldata = daoIface.encodeFunctionData("transferETH", [recipient, amount])
await factory.createProposal(description, [daoAddress], [0n], [calldata])
```

### Template: Transfer ERC20
```javascript
const calldata = daoIface.encodeFunctionData("transferERC20", [token, recipient, amount])
await factory.createProposal(description, [daoAddress], [0n], [calldata])
```

### Template: Mint Tokens
```javascript
const calldata = daoIface.encodeFunctionData("mint", [recipient, amount])
await factory.createProposal(description, [daoAddress], [0n], [calldata])
```

### Template: Change Parameter
```javascript
// Map parameter name to setter function
const setters = {
      supportThreshold: "setSupportThreshold",
        quorumPercentage: "setQuorumPercentage",
          maxProposalAge: "setMaxProposalAge",
            electionDuration: "setElectionDuration",
              vestingPeriod: "setVestingPeriod",
                tokenPrice: "setTokenPrice",
                  flags: "setFlags"
}
const calldata = daoIface.encodeFunctionData(setters[param], [value])
await factory.createProposal(description, [daoAddress], [0n], [calldata])
```

### Template: Arbitrary Call (Advanced)
```javascript
// User provides target, value, and raw calldata
await factory.createProposal(description, [target], [value], [calldata])
```

## Salvageable from Old Frontend

### Keep (logic is still valid):
- `utils/formatting.js` - address truncation, ETH formatting, basis points conversion
- `utils/notification.js` - notification state management
- Component structure and UI flow
- Bootstrap class usage patterns
- Election status calculation logic
- Vote percentage calculations

### Adapt (needs updates):
- `hooks/useDAO.ts` → `services/dao.js` - convert to plain functions, ethers v6
- `hooks/useWallet.ts` → `services/wallet.js` - convert to plain functions, ethers v6  
- `hooks/useProposals.ts` → `services/proposals.js` - update for unified proposal model
- `types/abis.ts` → `abis/*.json` - update ABIs for new contracts
- Component logic - port from React/TSX to VanJS

### Remove (no longer needed):
- TypeScript types (using plain JS)
- Vite config
- React-specific patterns (useCallback, useEffect, etc.)
- Separate proposal type detection logic (now unified)

## Development Setup

### Minimal (No Build Tools)
```bash
# Just serve static files
cd frontend
python -m http.server 8080
# or
npx serve .
```

### With Live Reload (Optional)
```bash
npx live-server --port=8080
```

### Testing with Local Blockchain
1. Start Anvil: `anvil`
2. Deploy contracts: `forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545`
3. Note the deployed addresses
4. Update `frontend/js/config.js` with addresses
5. Open `http://localhost:8080` in browser with MetaMask on localhost:8545

## Key Implementation Notes

1. **State Management**: Use VanJS `van.state()` for reactive state. Keep global state minimal - wallet connection, current DAO address, cached DAO info.

2. **Error Handling**: Wrap contract calls in try/catch. Show user-friendly errors via notifications.

3. **Loading States**: Show spinner during blockchain operations. The old `LoadingSpinner` component pattern works well.

4. **Caching**: Cache proposal details to avoid repeated RPC calls. Invalidate on user actions.

5. **Block Numbers**: Track current block for expiration calculations. Consider polling or subscribing to new blocks.

6. **Network Validation**: Check chain ID matches expected network. Prompt user to switch if wrong.

## Current Task

Rebuild the frontend using VanJS. Priority order:

1. **Basic shell**: index.html with CDN imports, app.js with routing
2. **Wallet connection**: Connect MetaMask, display address
3. **Dashboard**: Show DAO info, user balances, purchase tokens
4. **Proposal list**: Display active proposals with support progress
5. **Create proposal**: Form with templates that build calldata
6. **Elections**: Voting interface with claim/vote flow
7. **History**: Past proposals with results
8. **Members**: Token holder list

Start simple, iterate. The old React components are a good reference for UI structure and business logic.
