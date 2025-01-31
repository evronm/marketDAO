# Market DAO

MarketDAO is a governance concept, bringing market forces to bear on group decisions.  The cheif conceit of MarketDAO is that the voting rights should be saleable.  This is an MVP that allows for various configurations.

## Implementation Details

  - The DAO is built around an 1155 contract (inherits from the OpenZeppelin ERC1155 implementation) the first of whose tokens is a governance token.  
    - The number of governance tokens may be fixed at creation time, or they may be mintable by proposal/election without limit.
  - The DAO may also optionally control a treasury wallet.
  - A user must have Governance tokens to make proposals
  - Proposals all inherit from the Proposal base class.
    - The Proposal base class implements the entire proposal lifecycle including creation, support, election triggering, but not execution.  That's handled by the subclasses, which can also override other parts of the life cycle.
    - There are 3 proposal types:
        - resolutions - These are text only proposals.  The description is treated as a resolution to pass and is required. 
        - Treasury transfer - Transfer a specified number of tokens from the treasury to a specified address.  This type only applies to DAOs that control a treasury.  Description is optional; address, amount and token type are required.
        - Governance token mint - Mints a specified number of governance tokens to the specified address.  This type does not apply to DAOs with a fixed supply of governance tokens. Description is optional; address and amount are required.
  - Proposals must meet a support threshold to trigger an election.  This is based on total token supply.
    - Supporting a proposal costs only gas, but is limited by the number of governance tokens the user has. 
    - The same governance tokens can be used to support multiple proposals.
  - When an election is triggered:
    - A voting token is emitted to every governance token holder for every governance token they hold.  
        - The voting token ID is one higher than the previous voting token ID.
    - Addresses are created for "yes" and "no" votes
  - While an election is ongoing:
    - Any voting tokens sent to the "yes" or "no" address count as votes. Votes are irrevocable.
    - **Voting tokens may also be transferred from one address to another.  This is the distinguishing feature of this governance mechanism**.
    - The DAO does not implement a market for voting tokens, but voting tokens may be bought and sold on any existing marketplaces or directly between users
  - When an electino ends, the "yes" and "no" addresses no longer accept voting tokens, rendering the voting tokens worthless.
    - If, at the end of an election, the quorum is met and the "yes" votes outnumber the "no" votes, the resolution passes.  In this case, the election must be executed manually by any user.
    - If, at any point before the election ends, the "yes" vote total is more than half of the voting tokens issued, the proposal passes, thus obviating the need to execute it manually.
    - Likewise if at any point the "no" votes total more than half the voting tokens issued, the election ends and the proposal fails.

Initial parameters:
  - Name of the DAO
  - support threshold:  Percentage of tokens needed to trigger an election for a proposal.
  - Election quorum percentage.
  - Maximum age of a proposal that doesn't trigger an election.
  - Length of an election.
  - Treasury - a list of token types in the treasury.  If not present, no treasury is used and this is a governance only DAO.
    - Valid values for the list: "ETH", "ERC20", "ERC721", "ERC1155"
  - Allow/disallow governance token minting elections
  - inintial token distribution as key value pairs (address, amount)

Upon logging in, the user is presented with:
  - DAO info
  - A form to create a proposal
  - A list of active proposals with the ability to support them, or remove support from previously supported proposals.
  - A list of active elections with the ability to vote, or to execute completed elections.
    - For each active election, there are links to external markets where users can buy or sell their voting tokens.
  - A link to view the results of previous elections.

## Future Possibilities:
  - Multiple choice elections
  - Election length as a proposal parameter
  - A constitution, specified at creation time and requiring a tunable supermajority to change.
    - Different rules could require different threshholds to change.
  - staking for proposals - proposer puts up a stake which gets burned if the proposal is not accepted, or if the proposal is not passed.  
    - Supporting a proposal could also require a stake.


