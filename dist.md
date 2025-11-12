I need to implement treasury distribution functionality in the DAO.  This will take the form of a new proposal type that inherits from TreasuryProposal.  It's behavior will differ in the following ways:

- It will take 3 parameters:  Asset Type, Token Address, Token ID, amount (this is the amount per governance token to distribute).  Asset type can be anything but ERC721 because that just doesn't make sense.
- To validate the proposal it will ensure that amount x gov tokens outstanding is less than the amount in the treasury.  It will also lock up the same amount.
- When an election is triggered, it will deploy a new redemption contract with an empty claimants map
- When a user claims his voting tokens for that election, his address and token balance are added to the claimants map in the new contract.  This is done by a function in the redemption contract that can only be called by the proposal that created it.

The claim contract will hold the funds until the user claims them.  This is all to save gas.  Unclaimed funds will stay in the contract indefinitely.
