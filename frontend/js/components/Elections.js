// Elections Component
// Shows proposals in election with voting interface

window.Elections = () => {
  const { div, h3, h4, p, button, span, small } = van.tags

  return div(
    { class: 'container-fluid' },

    // Header
    div(
      { class: 'card mb-3' },
      div(
        { class: 'card-header' },
        h3({ class: 'mb-0' }, 'Active Elections')
      ),
      div(
        { class: 'card-body' },
        p({ class: 'text-muted mb-0' }, 'Proposals that have triggered elections and are currently in voting')
      )
    ),

    // Loading state
    () => {
      if (proposalsState.isLoading.val) {
        return div(
          { class: 'text-center py-5' },
          div({ class: 'spinner-border text-primary' }),
          p({ class: 'mt-2' }, 'Loading elections...')
        )
      }
      return null
    },

    // Error state
    () => {
      if (proposalsState.error.val) {
        return div(
          { class: 'alert alert-danger' },
          proposalsState.error.val
        )
      }
      return null
    },

    // Elections list
    () => {
      // Access both state values to establish dependencies
      const loading = proposalsState.isLoading.val
      const elections = proposalsState.elections.val

      if (loading) return null

      if (elections.length === 0) {
        return div(
          { class: 'card' },
          div(
            { class: 'card-body text-center py-5' },
            p({ class: 'text-muted mb-0' }, 'No active elections')
          )
        )
      }

      return div(
        elections.map(proposal => ElectionCard({ proposal }))
      )
    }
  )
}

/**
 * Individual election card with voting interface
 */
const ElectionCard = ({ proposal }) => {
  const { div, h4, p, button, span, small, hr } = van.tags

  const isVoting = van.state(false)
  const isClaiming = van.state(false)
  const isCheckingTermination = van.state(false)

  // Calculate vote percentages
  const yesVotes = BigInt(proposal.votes.yes)
  const noVotes = BigInt(proposal.votes.no)
  const totalVotes = yesVotes + noVotes

  const yesPercent = totalVotes > 0n ? Number(yesVotes * 10000n / totalVotes) / 100 : 0
  const noPercent = totalVotes > 0n ? Number(noVotes * 10000n / totalVotes) / 100 : 0

  // Calculate quorum
  const totalSupply = BigInt(proposal.votes.total)
  const quorumPercentage = BigInt(daoState.info.val.quorumPercentage || '5100')
  const quorumNeeded = totalSupply * quorumPercentage / 10000n
  const quorumCurrent = totalVotes
  const quorumPercent = totalSupply > 0n ? Number(quorumCurrent * 10000n / quorumNeeded) / 100 : 0

  // Handle claim voting tokens
  const handleClaim = async () => {
    if (isClaiming.val) return

    isClaiming.val = true
    try {
      const proposalContract = new ethers.Contract(
        proposal.address,
        PROPOSAL_ABI,
        walletState.signer.val
      )

      const tx = await proposalContract.claimVotingTokens()
      console.log('Claim transaction sent:', tx.hash)

      const receipt = await tx.wait(1)
      console.log('✅ Voting tokens claimed in block:', receipt.blockNumber)

      showNotification('Voting tokens claimed successfully!', 'success')

      // Reload just this proposal for better performance
      await reloadSingleProposal(proposal.address)
    } catch (err) {
      console.error('Claim error:', err)
      const parsedError = parseContractError(err, 'claim')
      showNotification(parsedError.message, 'danger')
    } finally {
      isClaiming.val = false
    }
  }

  // Handle manual early termination check
  const handleCheckEarlyTermination = async () => {
    if (isCheckingTermination.val) return

    isCheckingTermination.val = true
    try {
      const proposalContract = new ethers.Contract(
        proposal.address,
        PROPOSAL_ABI,
        walletState.signer.val
      )

      console.log('Manually checking for early termination...')
      const tx = await proposalContract.checkEarlyTermination()
      console.log('Early termination tx sent:', tx.hash)

      const receipt = await tx.wait(1)
      console.log('✅ Early termination check complete in block:', receipt.blockNumber)

      showNotification('Early termination check complete!', 'success')

      // Reload just this proposal for better performance
      await reloadSingleProposal(proposal.address)
    } catch (err) {
      console.error('Early termination check failed:', err)
      const parsedError = parseContractError(err, 'early termination check')
      const notificationType = parsedError.message === 'Transaction cancelled' ? 'info' : 'danger'
      showNotification(parsedError.message, notificationType)
    } finally {
      isCheckingTermination.val = false
    }
  }

  // Handle vote
  const handleVote = async (voteYes) => {
    if (isVoting.val) return

    isVoting.val = true
    try {
      console.log('Voting with proposal:', proposal)
      console.log('Vote YES?', voteYes)
      console.log('Yes address:', proposal.yesVoteAddress)
      console.log('No address:', proposal.noVoteAddress)

      const votingTokenId = proposal.votingTokenId || await (new ethers.Contract(
        proposal.address,
        PROPOSAL_ABI,
        walletState.signer.val
      )).votingTokenId()

      // Get user's voting token balance
      const daoContract = walletState.daoContract.val
      const balance = await daoContract.balanceOf(walletState.walletAddress.val, votingTokenId)

      if (balance === 0n) {
        showNotification('You have no voting tokens to cast. Claim your tokens first.', 'warning')
        isVoting.val = false
        return
      }

      // Transfer voting tokens to yes or no address
      const targetAddress = voteYes ? proposal.yesVoteAddress : proposal.noVoteAddress
      console.log('Target address for vote:', targetAddress)

      console.log(`Voting ${voteYes ? 'YES' : 'NO'} with ${balance.toString()} tokens`)

      const tx = await daoContract.safeTransferFrom(
        walletState.walletAddress.val,
        targetAddress,
        votingTokenId,
        balance,
        '0x'
      )

      console.log('Vote transaction sent:', tx.hash)
      const receipt = await tx.wait(1)
      console.log('✅ Vote cast in block:', receipt.blockNumber)

      showNotification(`Voted ${voteYes ? 'YES' : 'NO'} successfully!`, 'success')

      // Check for early termination (requires a separate transaction)
      try {
        const proposalContract = new ethers.Contract(
          proposal.address,
          PROPOSAL_ABI,
          walletState.signer.val
        )
        console.log('Checking for early termination...')
        showNotification('Checking if election can be terminated early...', 'info')

        const terminateTx = await proposalContract.checkEarlyTermination()
        console.log('Early termination tx sent:', terminateTx.hash)

        const terminateReceipt = await terminateTx.wait(1)
        console.log('✅ Early termination check complete in block:', terminateReceipt.blockNumber)

        // Check if it actually resolved
        const isResolved = await proposalContract.isResolved()
        console.log('After termination check, isResolved:', isResolved)

        if (isResolved) {
          showNotification('Election terminated early - result determined!', 'success')
        }
      } catch (err) {
        console.error('❌ Early termination check failed:', err)
        console.error('Error message:', err.message)

        // Only show error if it's not a user rejection
        if (!err.message.includes('user rejected') && !err.message.includes('User denied')) {
          showNotification('Early termination check failed: ' + err.message, 'warning')
        }
      }

      // Reload just this proposal for better performance
      await reloadSingleProposal(proposal.address)
    } catch (err) {
      console.error('Vote error:', err)
      const parsedError = parseContractError(err, 'vote')
      showNotification(parsedError.message, 'danger')
    } finally {
      isVoting.val = false
    }
  }

  return div(
    { class: 'card mb-3' },
    div(
      { class: 'card-body' },

      // Header
      div(
        { class: 'd-flex justify-content-between align-items-start mb-3' },
        div(
          h4({ class: 'card-title mb-1' }, proposal.description),
          small({ class: 'text-muted' },
            'Proposer: ' + truncateAddress(proposal.proposer)
          )
        ),
        span(
          {
            class: () => {
              if (proposal.electionStatus === 'Active') return 'badge bg-success'
              if (proposal.electionStatus === 'Ended') return 'badge bg-secondary'
              return 'badge bg-info'
            }
          },
          proposal.electionStatus
        )
      ),

      // Proposal type and details
      div(
        { class: 'mb-3' },
        span({ class: 'badge bg-info me-2' }, proposal.type.toUpperCase()),
        proposal.type === 'treasury' ? span({ class: 'text-muted' },
          'Transfer ' + formatEther(proposal.details.amount) + ' ETH to ' +
          truncateAddress(proposal.details.recipient)
        ) : proposal.type === 'mint' ? span({ class: 'text-muted' },
          'Mint ' + proposal.details.amount + ' tokens to ' +
          truncateAddress(proposal.details.recipient)
        ) : proposal.type === 'parameter' ? span({ class: 'text-muted' },
          'Change ' + proposal.details.parameter + ' to ' + proposal.details.newValue
        ) : null
      ),

      hr(),

      // Vote counts
      div(
        { class: 'mb-3' },
        h4({ class: 'mb-3' }, 'Votes'),

        // Yes votes
        div(
          { class: 'mb-2' },
          div({ class: 'd-flex justify-content-between mb-1' },
            span('YES'),
            span(formatAmount(proposal.votes.yes) + ' (' + yesPercent.toFixed(1) + '%)')
          ),
          div(
            { class: 'progress', style: 'height: 25px;' },
            div({
              class: 'progress-bar bg-success',
              style: 'width: ' + yesPercent + '%'
            })
          )
        ),

        // No votes
        div(
          { class: 'mb-2' },
          div({ class: 'd-flex justify-content-between mb-1' },
            span('NO'),
            span(formatAmount(proposal.votes.no) + ' (' + noPercent.toFixed(1) + '%)')
          ),
          div(
            { class: 'progress', style: 'height: 25px;' },
            div({
              class: 'progress-bar bg-danger',
              style: 'width: ' + noPercent + '%'
            })
          )
        ),

        // Quorum
        div(
          { class: 'mt-3' },
          div({ class: 'd-flex justify-content-between mb-1' },
            span('Quorum (' + formatBasisPoints(daoState.info.val.quorumPercentage) + ' required)'),
            span(formatAmount(quorumCurrent.toString()) + ' / ' + formatAmount(quorumNeeded.toString()) +
                 ' (' + quorumPercent.toFixed(1) + '%)')
          ),
          div(
            { class: 'progress', style: 'height: 20px;' },
            div({
              class: () => quorumPercent >= 100 ? 'progress-bar bg-success' : 'progress-bar bg-warning',
              style: 'width: ' + Math.min(quorumPercent, 100) + '%'
            })
          )
        )
      ),

      hr(),

      // User's voting status
      div(
        { class: 'mb-3' },
        proposal.votes.hasClaimed ?
          div(
            { class: 'alert alert-info mb-2' },
            '✓ You have claimed your voting tokens'
          ) :
          proposal.votes.claimable !== '0' ?
            div(
              { class: 'alert alert-success mb-2' },
              'You can claim ' + formatAmount(proposal.votes.claimable) + ' voting tokens'
            ) :
            div(
              { class: 'alert alert-warning mb-2' },
              'You have no voting power for this proposal (no tokens at election trigger)'
            )
      ),

      // Action buttons
      div(
        { class: 'd-flex gap-2' },

        // Claim button
        !proposal.votes.hasClaimed && proposal.votes.claimable !== '0' ?
          button(
            {
              class: 'btn btn-primary',
              onclick: handleClaim,
              disabled: () => isClaiming.val || proposal.electionStatus !== 'Active'
            },
            () => isClaiming.val ? 'Claiming...' : 'Claim Voting Tokens'
          ) : null,

        // Vote buttons (only if claimed)
        proposal.votes.hasClaimed && proposal.electionStatus === 'Active' ?
          div(
            { class: 'd-flex gap-2 w-100' },
            button(
              {
                class: 'btn btn-success flex-fill',
                onclick: () => handleVote(true),
                disabled: () => isVoting.val
              },
              () => isVoting.val ? 'Voting...' : 'Vote YES'
            ),
            button(
              {
                class: 'btn btn-danger flex-fill',
                onclick: () => handleVote(false),
                disabled: () => isVoting.val
              },
              () => isVoting.val ? 'Voting...' : 'Vote NO'
            )
          ) : null,

        // Manual early termination check button (shown when election is active)
        proposal.electionStatus === 'Active' ?
          button(
            {
              class: 'btn btn-warning',
              onclick: handleCheckEarlyTermination,
              disabled: () => isCheckingTermination.val,
              title: 'Check if one side has reached majority and can end the election early'
            },
            () => isCheckingTermination.val ? 'Checking...' : '⚡ Check Early End'
          ) : null
      ),

      // Result (if ended)
      proposal.electionStatus === 'Ended' && proposal.result ?
        div(
          { class: 'alert ' + (proposal.result.includes('APPROVED') ? 'alert-success' : 'alert-danger') + ' mt-3 mb-0' },
          'Result: ' + proposal.result
        ) : null
    )
  )
}
