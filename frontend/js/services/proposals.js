// Proposals service - handles loading and interacting with proposals
// Updated for unified proposal architecture

// Global proposals state
window.proposalsState = null

/**
 * Initialize proposals state
 */
window.initProposalsState = (van) => {
  window.proposalsState = {
    active: van.state([]),      // Proposals gathering support
    elections: van.state([]),   // Proposals in voting
    history: van.state([]),     // Completed proposals
    isLoading: van.state(false),
    error: van.state(null)
  }
  return window.proposalsState
}

/**
 * Load all proposals from factory
 */
window.loadAllProposals = async () => {
  if (!walletState.isConnected.val || !walletState.factoryContract.val) {
    console.warn('Cannot load proposals: not connected')
    return
  }

  proposalsState.isLoading.val = true
  proposalsState.error.val = null

  try {
    const factory = walletState.factoryContract.val
    const provider = walletState.provider.val
    const daoContract = walletState.daoContract.val

    // Get proposal count
    const count = await factory.proposalCount()

    const proposalAddresses = []
    for (let i = 0; i < count; i++) {
      const addr = await factory.proposals(i)
      proposalAddresses.push(addr)
    }

    // Fetch details for all proposals in parallel (much faster!)
    const proposalPromises = proposalAddresses.map(address =>
      fetchProposalDetails(address, provider, daoContract).catch(err => {
        console.warn(`Error fetching proposal ${address}:`, err)
        return null // Return null for failed proposals
      })
    )

    const proposalResults = await Promise.all(proposalPromises)
    const proposals = proposalResults.filter(p => p !== null) // Filter out failed proposals

    // Sort proposals into categories
    const active = []
    const elections = []
    const history = []

    for (const p of proposals) {
      if (p.executed || p.electionStatus === 'Ended') {
        history.push(p)
      } else if (p.electionTriggered) {
        elections.push(p)
      } else if (!p.isExpired) {
        active.push(p)
      } else {
        history.push(p)
      }
    }

    proposalsState.active.val = active
    proposalsState.elections.val = elections
    proposalsState.history.val = history
  } catch (err) {
    const message = err.message || 'Failed to load proposals'
    proposalsState.error.val = message
    console.error('Error loading proposals:', err)
  } finally {
    proposalsState.isLoading.val = false
  }
}

/**
 * Fetch details for a single proposal
 */
async function fetchProposalDetails(address, provider, daoContract) {
  // Create contract instance with unified ABI
  const proposalContract = new ethers.Contract(address, PROPOSAL_ABI, walletState.signer.val)

  // Get basic proposal info
  const [
    description,
    proposer,
    createdAt,
    supportTotal,
    electionTriggered,
    executed,
    electionStart,
    canTrigger
  ] = await Promise.all([
    proposalContract.description(),
    proposalContract.proposer(),
    proposalContract.createdAt(),
    proposalContract.supportTotal(),
    proposalContract.electionTriggered(),
    proposalContract.executed(),
    proposalContract.electionStart(),
    proposalContract.canTriggerElection()
  ])

  // Calculate expiration
  const currentBlock = await provider.getBlockNumber()
  const maxPropAge = BigInt(daoState.info.val.maxProposalAge || '100')
  const expirationBlock = createdAt + maxPropAge
  const isExpired = BigInt(currentBlock) >= expirationBlock && !electionTriggered

  // Get action to determine type (single action, not array)
  let proposalType = 'resolution'
  let details = {}
  try {
    // Use getFunction() to avoid conflict with ethers' target property
    const target = await proposalContract.getFunction('target')()
    const value = await proposalContract.getFunction('value')()
    const data = await proposalContract.getFunction('data')()

    const decoded = decodeProposalAction(target, value, data)
    proposalType = decoded.type
    details = decoded.details
  } catch (err) {
    // Silently fail for proposals that can't be decoded
  }

  // Build base proposal data (immutable)
  let proposal = {
    address,
    description,
    proposer,
    createdAt: createdAt.toString(),
    supportTotal: supportTotal.toString(),
    electionTriggered,
    executed,
    electionStart: electionStart.toString(),
    canTriggerElection: canTrigger,
    isExpired,
    expirationBlock: expirationBlock.toString(),
    type: proposalType,
    details,
    votes: { yes: '0', no: '0', total: '0', claimable: '0', hasClaimed: false },
    electionStatus: 'Not Started'
  }

  // If election triggered, get voting details and merge into new object
  if (electionTriggered) {
    try {
      const votingDetails = await loadVotingDetails(proposalContract, daoContract, provider, currentBlock, electionStart)
      proposal = { ...proposal, ...votingDetails }
    } catch (err) {
      console.error(`Error loading voting details for ${address}:`, err.message)
      // Keep default electionStatus of 'Not Started' if voting details fail to load
    }
  }

  return proposal
}

/**
 * Load voting details for a proposal in election
 * Returns an object with voting data to be merged (immutable pattern)
 */
async function loadVotingDetails(proposalContract, daoContract, provider, currentBlock, electionStart) {
  const proposalAddress = await proposalContract.getAddress()

  const votingTokenId = await proposalContract.votingTokenId()
  const [yesVoteAddress, noVoteAddress] = await Promise.all([
    proposalContract.yesVoteAddress(),
    proposalContract.noVoteAddress()
  ])

  const [yesVotes, noVotes, totalVotes, claimableAmount, hasClaimed, isResolved] = await Promise.all([
    daoContract.balanceOf(yesVoteAddress, votingTokenId),
    daoContract.balanceOf(noVoteAddress, votingTokenId),
    daoContract.totalSupply(votingTokenId),
    proposalContract.getClaimableAmount(walletState.walletAddress.val),
    proposalContract.hasClaimed(walletState.walletAddress.val),
    proposalContract.isResolved()
  ])

  // Calculate election status based on resolved state and block height
  let electionStatus = 'Not Started'
  let result = undefined

  if (isResolved) {
    electionStatus = 'Ended'

    // Calculate result from vote counts
    const quorumPercentage = BigInt(daoState.info.val.quorumPercentage)
    const quorum = totalVotes * quorumPercentage / 10000n

    if (yesVotes + noVotes < quorum) {
      result = 'REJECTED (Quorum not met)'
    } else if (yesVotes > noVotes) {
      result = 'APPROVED'
    } else {
      result = 'REJECTED'
    }
  } else {
    const electionDuration = BigInt(daoState.info.val.electionDuration)
    const electionEnd = BigInt(electionStart) + electionDuration
    const currentBlockBigInt = BigInt(currentBlock)

    if (currentBlockBigInt < BigInt(electionStart)) {
      electionStatus = 'Not Started'
    } else if (currentBlockBigInt >= electionEnd) {
      electionStatus = 'Ended'
    } else {
      electionStatus = 'Active'
    }
  }

  // Return immutable voting details object
  return {
    yesVoteAddress,
    noVoteAddress,
    votingTokenId: votingTokenId.toString(),
    votes: {
      yes: yesVotes.toString(),
      no: noVotes.toString(),
      total: totalVotes.toString(),
      claimable: claimableAmount.toString(),
      hasClaimed
    },
    electionStatus,
    result
  }
}

/**
 * Decode proposal action to determine type (single action)
 */
function decodeProposalAction(target, value, data) {
  // Empty data and DAO target = resolution
  if (data === '0x' || data.length === 0 || data === '0x00') {
    return { type: 'resolution', details: {} }
  }

  // Check if target is the DAO (most common case)
  if (target.toLowerCase() === CONFIG.contracts.dao.toLowerCase()) {
    try {
      const daoIface = new ethers.Interface(DAO_ABI)
      const parsed = daoIface.parseTransaction({ data })

      // Determine type based on function name
      if (parsed.name === 'transferETH') {
        return {
          type: 'treasury',
          details: {
            action: 'Transfer ETH',
            recipient: parsed.args[0],
            amount: parsed.args[1].toString(),
            token: ethers.ZeroAddress
          }
        }
      } else if (parsed.name === 'mintGovernanceTokens') {
        return {
          type: 'mint',
          details: {
            recipient: parsed.args[0],
            amount: parsed.args[1].toString()
          }
        }
      } else if (parsed.name.startsWith('set')) {
        // Parameter change (setSupportThreshold, setQuorumPercentage, etc.)
        return {
          type: 'parameter',
          details: {
            parameter: parsed.name.replace('set', ''),
            newValue: parsed.args[0].toString()
          }
        }
      }
    } catch (err) {
      console.warn('Could not parse DAO calldata:', err)
    }
  }

  // Unknown/custom action
  return {
    type: 'custom',
    details: {
      target,
      value: value.toString(),
      calldata: data
    }
  }
}

/**
 * Reload a single proposal by address (more efficient than reloading all)
 */
window.reloadSingleProposal = async (proposalAddress) => {
  if (!walletState.isConnected.val || !walletState.provider.val) {
    console.warn('Cannot reload proposal: not connected')
    return
  }

  try {
    const provider = walletState.provider.val
    const daoContract = walletState.daoContract.val

    const updatedProposal = await fetchProposalDetails(proposalAddress, provider, daoContract)

    // Update the proposal in the appropriate state array (immutable)
    const updateProposalInArray = (array) => {
      const index = array.findIndex(p => p.address === proposalAddress)
      if (index !== -1) {
        return [...array.slice(0, index), updatedProposal, ...array.slice(index + 1)]
      }
      return array
    }

    // Recategorize if needed
    let targetArray = 'active'
    if (updatedProposal.executed || updatedProposal.electionStatus === 'Ended') {
      targetArray = 'history'
    } else if (updatedProposal.electionTriggered) {
      targetArray = 'elections'
    } else if (!updatedProposal.isExpired) {
      targetArray = 'active'
    } else {
      targetArray = 'history'
    }

    // Read current state into local variables to avoid race conditions
    const currentActive = proposalsState.active.val
    const currentElections = proposalsState.elections.val
    const currentHistory = proposalsState.history.val

    // Filter out the old version of this proposal from all arrays
    const newActive = currentActive.filter(p => p.address !== proposalAddress)
    const newElections = currentElections.filter(p => p.address !== proposalAddress)
    const newHistory = currentHistory.filter(p => p.address !== proposalAddress)

    // Add to correct array
    if (targetArray === 'active') {
      newActive.push(updatedProposal)
    } else if (targetArray === 'elections') {
      newElections.push(updatedProposal)
    } else {
      newHistory.push(updatedProposal)
    }

    // Update all state at once (atomic update)
    proposalsState.active.val = newActive
    proposalsState.elections.val = newElections
    proposalsState.history.val = newHistory
  } catch (err) {
    console.error(`Error reloading proposal ${proposalAddress}:`, err)
    // Fall back to full reload on error
    await loadAllProposals()
  }
}

/**
 * Add support to a proposal
 */
window.supportProposal = async (proposalAddress, amount) => {
  const proposalContract = new ethers.Contract(proposalAddress, PROPOSAL_ABI, walletState.signer.val)
  const amountBigInt = BigInt(amount)

  const tx = await proposalContract.addSupport(amountBigInt)
  await tx.wait(1)

  await reloadSingleProposal(proposalAddress)
  await loadDAOInfo()
}

/**
 * Remove support from a proposal
 */
window.removeSupportFromProposal = async (proposalAddress, amount) => {
  const proposalContract = new ethers.Contract(proposalAddress, PROPOSAL_ABI, walletState.signer.val)
  const amountBigInt = BigInt(amount)

  const tx = await proposalContract.removeSupport(amountBigInt)
  await tx.wait(1)

  await reloadSingleProposal(proposalAddress)
  await loadDAOInfo()
}

/**
 * Trigger election for a proposal
 */
window.triggerElection = async (proposalAddress) => {
  const daoContract = walletState.daoContract.val

  const tx = await daoContract.triggerElection(proposalAddress)
  await tx.wait(1)

  await reloadSingleProposal(proposalAddress)
}

/**
 * Create a new proposal (unified architecture with single action)
 */
window.createProposal = async (type, description, params) => {
  const factory = walletState.factoryContract.val
  const daoAddress = CONFIG.contracts.dao

  let target = ethers.ZeroAddress
  let value = 0n
  let data = '0x'

  // Build calldata based on proposal type
  if (type === 'resolution') {
    // Resolution: target=DAO, empty data
    target = daoAddress
    value = 0n
    data = '0x'
  } else if (type === 'treasury') {
    // Transfer ETH from treasury
    if (!params.treasuryRecipient || !params.treasuryAmount) {
      throw new Error('Recipient and amount required for treasury proposal')
    }

    const daoIface = new ethers.Interface(DAO_ABI)
    const amount = ethers.parseEther(params.treasuryAmount)
    data = daoIface.encodeFunctionData('transferETH', [params.treasuryRecipient, amount])

    target = daoAddress
    value = 0n
  } else if (type === 'mint') {
    // Mint governance tokens
    if (!params.mintRecipient || !params.mintAmount) {
      throw new Error('Recipient and amount required for mint proposal')
    }

    const daoIface = new ethers.Interface(DAO_ABI)
    const amount = BigInt(params.mintAmount)
    data = daoIface.encodeFunctionData('mintGovernanceTokens', [params.mintRecipient, amount])

    target = daoAddress
    value = 0n
  } else if (type === 'parameter') {
    // Change DAO parameter
    if (!params.parameterName || !params.parameterValue) {
      throw new Error('Parameter name and value required')
    }

    // Map parameter name to setter function
    const setterMap = {
      'supportThreshold': 'setSupportThreshold',
      'quorumPercentage': 'setQuorumPercentage',
      'maxProposalAge': 'setMaxProposalAge',
      'electionDuration': 'setElectionDuration',
      'vestingPeriod': 'setVestingPeriod',
      'tokenPrice': 'setTokenPrice'
    }

    const setter = setterMap[params.parameterName]
    if (!setter) {
      throw new Error('Unknown parameter: ' + params.parameterName)
    }

    // Convert token price from ETH to wei, other params are integers
    let paramValue
    if (params.parameterName === 'tokenPrice') {
      paramValue = ethers.parseEther(params.parameterValue)
    } else {
      paramValue = BigInt(params.parameterValue)
    }

    const daoIface = new ethers.Interface(DAO_ABI)
    data = daoIface.encodeFunctionData(setter, [paramValue])

    target = daoAddress
    value = 0n
  } else {
    throw new Error('Unknown proposal type: ' + type)
  }

  const tx = await factory.createProposal(description, target, value, data)
  await tx.wait(1)

  // Reload all proposals since we don't know the new proposal address from here
  // (could extract from events, but full reload is simpler for proposal creation)
  await loadAllProposals()

  // Also refresh DAO info since creating proposals affects token balances
  await loadDAOInfo()
}
