# Market DAO

MarketDAO is a governance concept, bringing market forces to bear on group decisions.  The cheif conceit of MarketDAO is that the right to vote should be saleable.

This is a proof concept, structured as follows:

The DAO is built around an 1155 contract one of whose tokens is a governance token.  When there is an election, a voting token is emitted to every governance token holder for every governance token they hold.  

Also, an address is created for every election option.  For now, these consist of a "yes" address and a "no" address.  In the future, more options may be available.

To vote, a user transfers voting tokens to the appropriate address (though the mechanism is hidden from the user).  **A user may also transfer the tokens to other addresses. This is the distinguishing feature of this governance mechanism.**  

After an election, all voting token balances for that election are set to 0.

Any governance token holder can propose an election, and a given percentage of the governance tokens need to support the proposal for an election to occur.  This percentage is set at contract creation.

Initially, there will be two types of elections:

  - An election to mint and award governance tokens to a given address.
  - An election to pass or reject a text proposal.

Upon logging in, the user is presented with:

  - DAO info
  - A form to create a proposal
  - A list of active proposals with the ability to support them, or remove support from previously supported proposals.
    - Supporting a proposal costs nothing, but is limited by the number of governance tokens the user has. 
  - A list of active elections with the ability to vote, or to execute completed elections.
    - For each active election, the user should have a link to sell their voting tokens or buy voting tokens from other users.  These links should go to external markets.
  - Links to view the results of previous elections.


Initial parameters:
  - Name of the DAO
  - support threshold:  Percentage of tokens needed to trigger an election for a proposal.
  - Election quorum percentage.
  - Delay between a proposal receiving sufficient support and the start of an election.
  - Length of an election.

Proposal parameters:
  - For token award proposals:  Number of tokens and receiving address
  - For text proposals: Text of the proposal  

## Future Possibilities:
  - Additional tokens which can be minted and/or transferred.
  - Multiple choice elections, as hinted above
  - Election length as a proposal parameter
  - A constitution, specified at creation time and requiring a tunable supermajority to change.
    - Different rules could require different threshholds to change.
  - staking for proposals - proposer puts up a stake which gets burned if the proposal is not accepted, or if the proposal is not passed.  
    - Supporting a proposal could also require a stake.


