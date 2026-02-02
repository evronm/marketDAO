// Event listening service for real-time updates
// Listens for blockchain events and updates the UI accordingly

// Event listener state
window.eventListeners = {
  dao: null,
  proposals: new Map(),
  blockPoller: null
}

/**
 * Initialize event listeners for the DAO
 */
window.initializeEventListeners = () => {
  if (!walletState.isConnected.val || !walletState.daoContract.val) {
    return
  }

  // Clean up any existing listeners first
  cleanupEventListeners()

  // Listen for DAO token transfers (includes purchases, claims, support, voting)
  setupDAOTransferListener()

  // Start block polling for election status updates
  startBlockPolling()
}

/**
 * Set up listener for DAO token transfers
 * ERC1155 TransferSingle and TransferBatch events
 */
function setupDAOTransferListener() {
  const daoContract = walletState.daoContract.val
  const userAddress = walletState.walletAddress.val

  const transferFilter = daoContract.filters.TransferSingle()

  const handleTransfer = async (...args) => {
    try {
      // ethers v6 passes args differently - last arg is the event object
      const event = args[args.length - 1]
      const [operator, from, to, id, value] = args.slice(0, -1)

      // Check if this affects the current user
      const affectsUser = from?.toLowerCase() === userAddress.toLowerCase() ||
                         to?.toLowerCase() === userAddress.toLowerCase()

      if (affectsUser) {
        // Reload DAO info to update balances
        await loadDAOInfo()
      }

      // Check if this is a voting transfer (to a proposal's yes/no address)
      const proposals = [
        ...proposalsState.active.val,
        ...proposalsState.elections.val
      ]

      for (const proposal of proposals) {
        if (proposal.yesVoteAddress?.toLowerCase() === to?.toLowerCase() ||
            proposal.noVoteAddress?.toLowerCase() === to?.toLowerCase()) {
          await reloadSingleProposal(proposal.address)
          break
        }
      }
    } catch (err) {
      console.error('Error handling transfer event:', err)
    }
  }

  daoContract.on(transferFilter, handleTransfer)
  eventListeners.dao = { contract: daoContract, filter: transferFilter, handler: handleTransfer }
}

/**
 * Start polling for block updates
 */
function startBlockPolling() {
  const provider = walletState.provider.val
  const pollInterval = 15000 // 15 seconds

  let lastBlock = null

  const poll = async () => {
    try {
      const currentBlock = await provider.getBlockNumber()

      if (lastBlock !== null && currentBlock !== lastBlock) {
        // Check if any elections might have changed status
        const elections = proposalsState.elections.val

        if (elections.length > 0) {
          // Reload elections that might have ended
          for (const proposal of elections) {
            const electionStart = BigInt(proposal.electionStart)
            const electionDuration = BigInt(daoState.info.val.electionDuration)
            const electionEnd = electionStart + electionDuration

            // Check if election might have just ended
            if (BigInt(currentBlock) >= electionEnd && BigInt(lastBlock) < electionEnd) {
              await reloadSingleProposal(proposal.address)
            }
          }
        }

        // Check if any proposals might have expired
        const active = proposalsState.active.val
        if (active.length > 0) {
          for (const proposal of active) {
            const createdAt = BigInt(proposal.createdAt)
            const maxAge = BigInt(daoState.info.val.maxProposalAge)
            const expirationBlock = createdAt + maxAge

            // Check if proposal might have just expired
            if (BigInt(currentBlock) >= expirationBlock && BigInt(lastBlock) < expirationBlock) {
              await reloadSingleProposal(proposal.address)
            }
          }
        }
      }

      lastBlock = currentBlock
    } catch (err) {
      console.error('Error polling blocks:', err)
    }
  }

  // Start polling
  eventListeners.blockPoller = setInterval(poll, pollInterval)

  // Do initial poll
  poll()
}

/**
 * Clean up all event listeners
 */
window.cleanupEventListeners = () => {
  // Remove DAO listener
  if (eventListeners.dao) {
    try {
      eventListeners.dao.contract.off(eventListeners.dao.filter, eventListeners.dao.handler)
    } catch (err) {
      console.error('Error removing DAO listener:', err)
    }
    eventListeners.dao = null
  }

  // Remove proposal listeners
  for (const [address, listener] of eventListeners.proposals) {
    try {
      listener.contract.off(listener.filter, listener.handler)
    } catch (err) {
      console.error(`Error removing listener for ${address}:`, err)
    }
  }
  eventListeners.proposals.clear()

  // Stop block polling
  if (eventListeners.blockPoller) {
    clearInterval(eventListeners.blockPoller)
    eventListeners.blockPoller = null
  }
}

/**
 * Re-initialize event listeners (useful after wallet change)
 */
window.reinitializeEventListeners = () => {
  cleanupEventListeners()

  // Wait a bit for state to settle
  setTimeout(() => {
    if (walletState.isConnected.val) {
      initializeEventListeners()
    }
  }, 100)
}
