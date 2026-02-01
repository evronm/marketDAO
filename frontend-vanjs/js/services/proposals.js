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

    console.log('Loading proposals...')

    // Get proposal count
    const count = await factory.proposalCount()
    console.log(`Found ${count} proposals`)

    const proposalAddresses = []
    for (let i = 0; i < count; i++) {
      const addr = await factory.proposals(i)
      proposalAddresses.push(addr)
    }

    // Fetch details for each proposal
    const proposals = []
    for (const address of proposalAddresses) {
      try {
        const proposal = await fetchProposalDetails(address, provider, daoContract)
        if (proposal) {
          proposals.push(proposal)
        }
      } catch (err) {
        console.warn(`Error fetching proposal ${address}:`, err)
      }
    }

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

    console.log('✅ Proposals loaded:', {
      active: active.length,
      elections: elections.length,
      history: history.length
    })
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
  // Note: "target" conflicts with Proxy.target, so we use getFunction
  let proposalType = 'resolution'
  let details = {}
  try {
    console.log('Fetching proposal action for:', address)
    const targetFn = proposalContract.getFunction('target')
    const valueFn = proposalContract.getFunction('value')
    const dataFn = proposalContract.getFunction('data')

    const target = await targetFn()
    console.log('Target:', target)
    const value = await valueFn()
    console.log('Value:', value.toString())
    const data = await dataFn()
    console.log('Data:', data)

    const decoded = decodeProposalAction(target, value, data)
    proposalType = decoded.type
    details = decoded.details
    console.log('Decoded type:', proposalType, 'details:', details)
  } catch (err) {
    console.error('❌ Could not decode action:', err)
    console.error('Error details:', err.message, err.stack)
  }

  // Build proposal data
  const proposal = {
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

  // If election triggered, get voting details
  if (electionTriggered) {
    await loadVotingDetails(proposal, proposalContract, daoContract, provider, currentBlock)
  }

  return proposal
}

/**
 * Load voting details for a proposal in election
 */
async function loadVotingDetails(proposal, proposalContract, daoContract, provider, currentBlock) {
  const [votingTokenId, yesVoteAddress, noVoteAddress] = await Promise.all([
    proposalContract.votingTokenId(),
    proposalContract.yesVoteAddress(),
    proposalContract.noVoteAddress()
  ])

  const [yesVotes, noVotes, totalVotes, claimableAmount, hasClaimed] = await Promise.all([
    daoContract.balanceOf(yesVoteAddress, votingTokenId),
    daoContract.balanceOf(noVoteAddress, votingTokenId),
    daoContract.totalSupply(votingTokenId),
    proposalContract.getClaimableAmount(walletState.walletAddress.val),
    proposalContract.hasClaimed(walletState.walletAddress.val)
  ])

  proposal.votes = {
    yes: yesVotes.toString(),
    no: noVotes.toString(),
    total: totalVotes.toString(),
    claimable: claimableAmount.toString(),
    hasClaimed
  }

  // Determine election status
  const electionDuration = BigInt(daoState.info.val.electionDuration)
  const electionEnd = BigInt(proposal.electionStart) + electionDuration

  if (BigInt(currentBlock) < BigInt(proposal.electionStart)) {
    proposal.electionStatus = 'Not Started'
  } else if (BigInt(currentBlock) >= electionEnd) {
    proposal.electionStatus = 'Ended'

    // Calculate result
    if (!proposal.executed) {
      const quorumPercentage = BigInt(daoState.info.val.quorumPercentage)
      const quorum = totalVotes * quorumPercentage / 10000n

      if (yesVotes + noVotes < quorum) {
        proposal.result = 'REJECTED (Quorum not met)'
      } else if (yesVotes > noVotes) {
        proposal.result = 'APPROVED'
      } else {
        proposal.result = 'REJECTED'
      }
    }
  } else {
    proposal.electionStatus = 'Active'
  }
}

/**
 * Decode proposal action to determine type (single action)
 */
function decodeProposalAction(target, value, data) {
  console.log('Decoding proposal action:', { target, value: value.toString(), data, dataLength: data.length })

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
 * Add support to a proposal
 */
window.supportProposal = async (proposalAddress, amount) => {
  const proposalContract = new ethers.Contract(proposalAddress, PROPOSAL_ABI, walletState.signer.val)
  const amountBigInt = BigInt(amount)

  console.log(`Adding ${amount} support to proposal ${proposalAddress}`)

  const tx = await proposalContract.addSupport(amountBigInt)
  console.log('Transaction sent:', tx.hash)

  await tx.wait()
  console.log('✅ Support added')

  // Reload proposals
  await loadAllProposals()
}

/**
 * Remove support from a proposal
 */
window.removeSupportFromProposal = async (proposalAddress, amount) => {
  const proposalContract = new ethers.Contract(proposalAddress, PROPOSAL_ABI, walletState.signer.val)
  const amountBigInt = BigInt(amount)

  console.log(`Removing ${amount} support from proposal ${proposalAddress}`)

  const tx = await proposalContract.removeSupport(amountBigInt)
  console.log('Transaction sent:', tx.hash)

  await tx.wait()
  console.log('✅ Support removed')

  // Reload proposals
  await loadAllProposals()
}

/**
 * Trigger election for a proposal
 */
window.triggerElection = async (proposalAddress) => {
  const daoContract = walletState.daoContract.val

  console.log(`Triggering election for proposal ${proposalAddress}`)

  // The DAO contract has the triggerElection function
  const tx = await daoContract.triggerElection(proposalAddress)
  console.log('Transaction sent:', tx.hash)

  await tx.wait()
  console.log('✅ Election triggered')

  // Reload proposals
  await loadAllProposals()
}

/**
 * Create a new proposal (unified architecture with single action)
 */
window.createProposal = async (type, description, params) => {
  const factory = walletState.factoryContract.val
  const daoAddress = CONFIG.contracts.dao

  console.log(`Creating ${type} proposal:`, description)

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

    const daoIface = new ethers.Interface(DAO_ABI)
    const paramValue = BigInt(params.parameterValue)
    data = daoIface.encodeFunctionData(setter, [paramValue])

    target = daoAddress
    value = 0n
  } else {
    throw new Error('Unknown proposal type: ' + type)
  }

  console.log('Proposal calldata:', {
    description,
    target,
    value: value.toString(),
    data,
    descriptionLength: description.length
  })

  // Check user has vested tokens
  const vestedBalance = await walletState.daoContract.val.vestedBalance(walletState.walletAddress.val)
  console.log('User vested balance:', vestedBalance.toString())

  // Create proposal via factory
  console.log('Calling factory.createProposal...')
  const tx = await factory.createProposal(description, target, value, data)
  console.log('Transaction sent:', tx.hash)

  const receipt = await tx.wait()
  console.log('✅ Proposal created in block:', receipt.blockNumber)

  // Reload proposals
  await loadAllProposals()
}
