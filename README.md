# Market DAO

MarketDAO is a governance concept, bringing market forces to bear on group decisions.  The cheif conceit of MarketDAO is that the voting rights should be saleable.  This is a proof concept and as such is short on features. 

## POC Details

  - The DAO is built around an 1155 contract the first of whose tokens is a governance token.  
  - A user must have Governance tokens to make proposals
  - A proposal consists of a description field and optional address and amount fields
    - Proposals that contain an amount must also contain a valid address.  If the proposal passes, the specified number of governance tokens are minted to the specified address.
    - Proposals that do no contains an amount and address must contain a description.  These will be considered "resolutions" in the DAO if they pass.
  - Proposals must meet a support threshold to trigger an election.
    - Supporting a proposal costs only gas, but is limited by the number of governance tokens the user has. 
  - When an election is triggered:
    - A voting token is emitted to every governance token holder for every governance token they hold.  
    - Addresses are created for "yes" and "no" votes
  - While an election is ongoing:
    - Any voting tokens sent to the "yes" or "no" address count as votes. Votes are irrevocable.
    - **Voting tokens may also be transferred from one address to another.  This is the distinguishing feature of this governance mechanism**.
    - The DAO does not implement a market for voting tokens, but voting tokens may be bought and sold on any existing marketplaces or directly between users
  - When an electino ends, the "yes" and "no" addresses no longer accept voting tokens, rendering the voting tokens worthless
    - If, at the end of an election, the quorum is met and the "yes" votes outnumber the "no" votes, the resolution passes.  In this case, the election must be executed manually by any user.
    - If, at any point before the election ends, the "yes" vote total is more than half of the voting tokens issued, the resolution passes, thus obviating the need to execute it manually.

Upon logging in, the user is presented with:

  - DAO info
  - A form to create a proposal
  - A list of active proposals with the ability to support them, or remove support from previously supported proposals.
  - A list of active elections with the ability to vote, or to execute completed elections.
    - For each active election, there are links to external markets where users can buy or sell their voting tokens.
  - A link to view the results of previous elections.


Initial parameters:
  - Name of the DAO
  - support threshold:  Percentage of tokens needed to trigger an election for a proposal.
  - Election quorum percentage.
  - Maximum age of a proposal that doesn't trigger an election.
  - Length of an election.

## Future Possibilities:
  - Additional tokens which can be minted and/or transferred.
  - Multiple choice elections, as hinted above
  - Election length as a proposal parameter
  - A constitution, specified at creation time and requiring a tunable supermajority to change.
    - Different rules could require different threshholds to change.
  - staking for proposals - proposer puts up a stake which gets burned if the proposal is not accepted, or if the proposal is not passed.  
    - Supporting a proposal could also require a stake.


