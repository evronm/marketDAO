// Dashboard Component
// Displays DAO info, user balances, and all actions (token operations + proposals)

window.Dashboard = () => {
  const { div, h3, h5, p, button, input, textarea, label, span, small, nav, ul, li, a, select, option } = van.tags

  // Tab state for Actions card
  const activeActionTab = van.state('purchase')

  // Token purchase state
  const purchaseAmount = van.state('1')
  const isPurchasing = van.state(false)
  const isClaiming = van.state(false)

  // Proposal form state
  const description = van.state('')
  const isSubmitting = van.state(false)

  // Treasury form
  const treasuryRecipient = van.state('')
  const treasuryAmount = van.state('')

  // Mint form
  const mintRecipient = van.state('')
  const mintAmount = van.state('')

  // Parameter form
  const parameterName = van.state('supportThreshold')
  const parameterValue = van.state('')

  // Reset proposal form
  const resetProposalForm = () => {
    description.val = ''
    treasuryRecipient.val = ''
    treasuryAmount.val = ''
    mintRecipient.val = ''
    mintAmount.val = ''
    parameterValue.val = ''
  }

  // Handle purchase tokens
  const handlePurchase = async () => {
    const amount = purchaseAmount.val

    if (!isValidAmount(amount)) {
      showNotification('Please enter a valid amount (positive number)', 'warning')
      return
    }

    const amountInt = parseInt(amount)
    if (amountInt <= 0) {
      showNotification('Amount must be greater than 0', 'warning')
      return
    }

    const availableTokens = BigInt(daoState.info.val.availableTokensForPurchase || '0')
    if (availableTokens > 0n && BigInt(amountInt) > availableTokens) {
      showNotification(`Only ${availableTokens} tokens available for purchase`, 'warning')
      return
    }

    isPurchasing.val = true
    try {
      await purchaseTokens(amountInt)
      showNotification(`Successfully purchased ${amountInt} token(s)!`, 'success')
      purchaseAmount.val = '1'
    } catch (err) {
      console.error('Purchase error:', err)
      let errorMsg = err.message || 'Failed to purchase tokens'
      if (err.message.includes('insufficient funds')) {
        errorMsg = 'Insufficient ETH for this purchase. Check your wallet balance and try a smaller amount.'
      } else if (err.message.includes('user rejected')) {
        errorMsg = 'Transaction cancelled'
      }
      showNotification(errorMsg, 'danger')
    } finally {
      isPurchasing.val = false
    }
  }

  // Handle claim vested tokens
  const handleClaim = async () => {
    isClaiming.val = true
    try {
      await claimVestedTokens()
      showNotification('Successfully claimed vested tokens!', 'success')
    } catch (err) {
      console.error('Claim error:', err)
      showNotification(err.message || 'Failed to claim vested tokens', 'danger')
    } finally {
      isClaiming.val = false
    }
  }

  // Handle create proposal
  const handleCreateProposal = async (type) => {
    // Don't allow multiple simultaneous submissions
    if (isSubmitting.val) return

    const validation = validateProposalInputs(
      type,
      description.val,
      {
        treasuryRecipient: treasuryRecipient.val,
        treasuryAmount: treasuryAmount.val,
        mintRecipient: mintRecipient.val,
        mintAmount: mintAmount.val,
        parameterName: parameterName.val,
        parameterValue: parameterValue.val
      },
      daoState.info.val
    )

    if (!validation.valid) {
      showNotification(validation.error, 'warning')
      return
    }

    isSubmitting.val = true
    try {
      await createProposal(
        type,
        description.val,
        {
          treasuryRecipient: treasuryRecipient.val,
          treasuryAmount: treasuryAmount.val,
          mintRecipient: mintRecipient.val,
          mintAmount: mintAmount.val,
          parameterName: parameterName.val,
          parameterValue: parameterValue.val
        }
      )

      showNotification('Proposal created successfully!', 'success')
      resetProposalForm()

      // Reload proposals in background
      loadAllProposals().catch(err => {
        console.error('Error reloading proposals:', err)
      })
    } catch (err) {
      console.error('Create proposal error:', err)
      const parsedError = parseContractError(err, 'create')
      showNotification(parsedError.message, 'danger')
    } finally {
      // Always reset submitting state
      isSubmitting.val = false
    }
  }

  return div(
    // DAO Info Card
    div(
      { class: 'card mb-3' },
      div(
        { class: 'card-header d-flex justify-content-between align-items-center' },
        h5({ class: 'mb-0' }, () => daoState.info.val.name),
        button(
          {
            class: 'btn btn-sm btn-outline-primary',
            onclick: loadDAOInfo,
            disabled: () => daoState.isLoading.val
          },
          () => daoState.isLoading.val ? 'Loading...' : '🔄 Refresh'
        )
      ),
      div(
        { class: 'card-body' },
        () => {
          if (daoState.error.val) {
            return div(
              { class: 'alert alert-danger' },
              'Error loading DAO info: ', daoState.error.val
            )
          }

          if (daoState.isLoading.val) {
            return div(
              { class: 'text-center py-4' },
              div({ class: 'spinner-border text-primary', role: 'status' }),
              p({ class: 'mt-2' }, 'Loading DAO information...')
            )
          }

          const info = daoState.info.val

          return div(
            div(
              { class: 'mb-4' },
              h5({ class: 'mb-3' }, 'DAO Parameters'),
              div(
                { class: 'row' },
                div(
                  { class: 'col-md-6' },
                  p({ class: 'mb-2' },
                    span({ class: 'fw-bold' }, 'Token Price: '),
                    info.tokenPrice + ' ETH'
                  ),
                  p({ class: 'mb-2' },
                    span({ class: 'fw-bold' }, 'Total Supply: '),
                    info.tokenSupply
                  ),
                  p({ class: 'mb-2' },
                    span({ class: 'fw-bold' }, 'Treasury Balance: '),
                    info.treasuryBalance + ' ETH'
                  )
                ),
                div(
                  { class: 'col-md-6' },
                  p({ class: 'mb-2' },
                    span({ class: 'fw-bold' }, 'Quorum: '),
                    basisPointsToPercent(info.quorumPercentage) + '%'
                  ),
                  p({ class: 'mb-2' },
                    span({ class: 'fw-bold' }, 'Support Threshold: '),
                    basisPointsToPercent(info.supportThreshold) + '%'
                  ),
                  p({ class: 'mb-2' },
                    span({ class: 'fw-bold' }, 'Max Proposal Age: '),
                    info.maxProposalAge + ' blocks'
                  ),
                  p({ class: 'mb-2' },
                    span({ class: 'fw-bold' }, 'Election Duration: '),
                    info.electionDuration + ' blocks'
                  )
                )
              )
            )
          )
        }
      )
    ),

    // User Balances Card
    div(
      { class: 'card mb-3' },
      div(
        { class: 'card-header' },
        h5({ class: 'mb-0' }, 'Your Balances')
      ),
      div(
        { class: 'card-body' },
        () => {
          if (daoState.isLoading.val) {
            return div('Loading...')
          }

          const info = daoState.info.val

          return div(
            { class: 'row' },
            div(
              { class: 'col-md-4' },
              div(
                { class: 'text-center p-3 bg-light rounded' },
                h3({ class: 'mb-0' }, info.tokenBalance),
                small({ class: 'text-muted' }, 'Total Tokens')
              )
            ),
            div(
              { class: 'col-md-4' },
              div(
                { class: 'text-center p-3 bg-success bg-opacity-10 rounded' },
                h3({ class: 'mb-0' }, info.vestedBalance),
                small({ class: 'text-muted' }, 'Vested (Available)')
              )
            ),
            div(
              { class: 'col-md-4' },
              div(
                { class: 'text-center p-3 bg-warning bg-opacity-10 rounded' },
                h3({ class: 'mb-0' }, info.unvestedBalance),
                small({ class: 'text-muted' }, 'Unvested (Locked)')
              )
            )
          )
        }
      )
    ),

    // Claim Vested Tokens Alert
    () => {
      if (!daoState.info.val.hasClaimableVesting) return null

      return div(
        { class: 'alert alert-info d-flex justify-content-between align-items-center mb-3' },
        div(
          h5({ class: 'mb-0' }, '🎉 You have vested tokens to claim!'),
          small({ class: 'text-muted' }, 'Unlock your vested tokens to use them.')
        ),
        button(
          {
            class: 'btn btn-success',
            onclick: handleClaim,
            disabled: () => daoState.isLoading.val || isClaiming.val
          },
          () => isClaiming.val ? 'Claiming...' : 'Claim Vested Tokens'
        )
      )
    },

    // Actions Card with Tabs
    div(
      { class: 'card' },
      div(
        { class: 'card-header' },
        h5({ class: 'mb-0' }, 'Actions')
      ),
      div(
        { class: 'card-body' },

        // Action tabs
        nav(
          ul(
            { class: 'nav nav-tabs mb-3' },
            li(
              { class: 'nav-item' },
              a(
                {
                  class: () => `nav-link ${activeActionTab.val === 'purchase' ? 'active' : ''}`,
                  href: '#',
                  onclick: (e) => {
                    e.preventDefault()
                    activeActionTab.val = 'purchase'
                  }
                },
                'Purchase Tokens'
              )
            ),
            li(
              { class: 'nav-item' },
              a(
                {
                  class: () => `nav-link ${activeActionTab.val === 'resolution' ? 'active' : ''}`,
                  href: '#',
                  onclick: (e) => {
                    e.preventDefault()
                    activeActionTab.val = 'resolution'
                  }
                },
                'Resolution'
              )
            ),
            li(
              { class: 'nav-item' },
              a(
                {
                  class: () => `nav-link ${activeActionTab.val === 'treasury' ? 'active' : ''}`,
                  href: '#',
                  onclick: (e) => {
                    e.preventDefault()
                    activeActionTab.val = 'treasury'
                  }
                },
                'Treasury'
              )
            ),
            li(
              { class: 'nav-item' },
              a(
                {
                  class: () => `nav-link ${activeActionTab.val === 'mint' ? 'active' : ''}`,
                  href: '#',
                  onclick: (e) => {
                    e.preventDefault()
                    activeActionTab.val = 'mint'
                  }
                },
                'Mint'
              )
            ),
            li(
              { class: 'nav-item' },
              a(
                {
                  class: () => `nav-link ${activeActionTab.val === 'parameter' ? 'active' : ''}`,
                  href: '#',
                  onclick: (e) => {
                    e.preventDefault()
                    activeActionTab.val = 'parameter'
                  }
                },
                'Parameters'
              )
            )
          )
        ),

        // Tab content
        () => {
          switch (activeActionTab.val) {
            case 'purchase':
              return div(
                h5({ class: 'mb-3' }, 'Purchase Governance Tokens'),
                div(
                  { class: 'row align-items-end' },
                  div(
                    { class: 'col-md-6' },
                    label({ class: 'form-label' }, 'Amount'),
                    input({
                      type: 'number',
                      class: 'form-control',
                      min: '1',
                      value: () => purchaseAmount.val,
                      oninput: (e) => purchaseAmount.val = e.target.value,
                      disabled: () => daoState.isLoading.val || isPurchasing.val
                    })
                  ),
                  div(
                    { class: 'col-md-6' },
                    button(
                      {
                        class: 'btn btn-primary w-100',
                        onclick: handlePurchase,
                        disabled: () => daoState.isLoading.val || isPurchasing.val
                      },
                      () => isPurchasing.val ? 'Purchasing...' : 'Purchase Tokens'
                    ),
                    () => {
                      const amount = parseInt(purchaseAmount.val) || 0
                      const info = daoState.info.val
                      const cost = (parseFloat(info.tokenPrice) * amount).toFixed(4)
                      return small(
                        { class: 'text-muted d-block mt-1' },
                        'Cost: ' + cost + ' ETH'
                      )
                    }
                  )
                )
              )

            case 'resolution':
              return div(
                h5({ class: 'mb-3' }, 'Create Resolution Proposal'),
                p({ class: 'text-muted mb-3' }, 'A resolution makes a statement but executes no on-chain actions.'),

                // Check vested balance
                () => {
                  const vestedBalance = BigInt(daoState.info.val.vestedBalance || '0')
                  if (vestedBalance === 0n) {
                    return div(
                      { class: 'alert alert-warning' },
                      p({ class: 'mb-2' }, '⚠️ You need vested (unlocked) governance tokens to create proposals.'),
                      p({ class: 'mb-0' },
                        'Your tokens are currently locked in vesting. ',
                        'You have ', daoState.info.val.unvestedBalance, ' unvested tokens that will unlock over time.'
                      )
                    )
                  }
                  return null
                },

                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Description'),
                  textarea({
                    class: 'form-control',
                    rows: '4',
                    placeholder: 'Describe your resolution...',
                    value: () => description.val,
                    oninput: (e) => description.val = e.target.value
                  }),
                  small({ class: 'text-muted' }, 'Explain what this resolution is for and why it should pass')
                ),
                button(
                  {
                    class: 'btn btn-primary w-100',
                    onclick: () => handleCreateProposal('resolution'),
                    disabled: () => isSubmitting.val
                  },
                  () => isSubmitting.val ? 'Creating...' : 'Create Resolution'
                )
              )

            case 'treasury':
              return div(
                h5({ class: 'mb-3' }, 'Create Treasury Transfer Proposal'),
                p({ class: 'text-muted mb-3' }, 'Transfer ETH from the DAO treasury to a recipient address.'),

                // Check vested balance
                () => {
                  const vestedBalance = BigInt(daoState.info.val.vestedBalance || '0')
                  if (vestedBalance === 0n) {
                    return div(
                      { class: 'alert alert-warning mb-3' },
                      '⚠️ You need vested governance tokens to create proposals.'
                    )
                  }
                  return null
                },

                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Description'),
                  textarea({
                    class: 'form-control',
                    rows: '3',
                    placeholder: 'Describe the purpose of this transfer...',
                    value: () => description.val,
                    oninput: (e) => description.val = e.target.value
                  })
                ),
                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Recipient Address'),
                  input({
                    type: 'text',
                    class: 'form-control',
                    placeholder: '0x...',
                    value: () => treasuryRecipient.val,
                    oninput: (e) => treasuryRecipient.val = e.target.value
                  })
                ),
                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Amount (ETH)'),
                  input({
                    type: 'number',
                    class: 'form-control',
                    placeholder: '0.1',
                    step: '0.01',
                    value: () => treasuryAmount.val,
                    oninput: (e) => treasuryAmount.val = e.target.value
                  }),
                  small(
                    { class: 'text-muted' },
                    'Treasury balance: ' + daoState.info.val.treasuryBalance + ' ETH'
                  )
                ),
                button(
                  {
                    class: 'btn btn-primary w-100',
                    onclick: () => handleCreateProposal('treasury'),
                    disabled: () => isSubmitting.val
                  },
                  () => isSubmitting.val ? 'Creating...' : 'Create Treasury Proposal'
                )
              )

            case 'mint':
              return div(
                h5({ class: 'mb-3' }, 'Create Mint Tokens Proposal'),
                p({ class: 'text-muted mb-3' }, 'Mint new governance tokens to a recipient address.'),

                // Check vested balance
                () => {
                  const vestedBalance = BigInt(daoState.info.val.vestedBalance || '0')
                  if (vestedBalance === 0n) {
                    return div(
                      { class: 'alert alert-warning mb-3' },
                      '⚠️ You need vested governance tokens to create proposals.'
                    )
                  }
                  return null
                },

                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Description'),
                  textarea({
                    class: 'form-control',
                    rows: '3',
                    placeholder: 'Describe why these tokens should be minted...',
                    value: () => description.val,
                    oninput: (e) => description.val = e.target.value
                  })
                ),
                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Recipient Address'),
                  input({
                    type: 'text',
                    class: 'form-control',
                    placeholder: '0x...',
                    value: () => mintRecipient.val,
                    oninput: (e) => mintRecipient.val = e.target.value
                  })
                ),
                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Amount (tokens)'),
                  input({
                    type: 'number',
                    class: 'form-control',
                    placeholder: '100',
                    value: () => mintAmount.val,
                    oninput: (e) => mintAmount.val = e.target.value
                  }),
                  small(
                    { class: 'text-muted' },
                    'Current supply: ' + daoState.info.val.tokenSupply + ' tokens'
                  )
                ),
                button(
                  {
                    class: 'btn btn-primary w-100',
                    onclick: () => handleCreateProposal('mint'),
                    disabled: () => isSubmitting.val
                  },
                  () => isSubmitting.val ? 'Creating...' : 'Create Mint Proposal'
                )
              )

            case 'parameter':
              return div(
                h5({ class: 'mb-3' }, 'Create Parameter Change Proposal'),
                p({ class: 'text-muted mb-3' }, 'Change a DAO governance parameter.'),

                // Check vested balance
                () => {
                  const vestedBalance = BigInt(daoState.info.val.vestedBalance || '0')
                  if (vestedBalance === 0n) {
                    return div(
                      { class: 'alert alert-warning mb-3' },
                      '⚠️ You need vested governance tokens to create proposals.'
                    )
                  }
                  return null
                },

                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Description'),
                  textarea({
                    class: 'form-control',
                    rows: '3',
                    placeholder: 'Describe why this parameter should be changed...',
                    value: () => description.val,
                    oninput: (e) => description.val = e.target.value
                  })
                ),
                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'Parameter'),
                  select(
                    {
                      class: 'form-select',
                      value: () => parameterName.val,
                      onchange: (e) => parameterName.val = e.target.value
                    },
                    option({ value: 'supportThreshold' }, 'Support Threshold'),
                    option({ value: 'quorumPercentage' }, 'Quorum Percentage'),
                    option({ value: 'maxProposalAge' }, 'Max Proposal Age (blocks)'),
                    option({ value: 'electionDuration' }, 'Election Duration (blocks)'),
                    option({ value: 'vestingPeriod' }, 'Vesting Period (blocks)'),
                    option({ value: 'tokenPrice' }, 'Token Price (ETH)')
                  )
                ),
                div(
                  { class: 'mb-3' },
                  label({ class: 'form-label' }, 'New Value'),
                  input({
                    type: 'text',
                    class: 'form-control',
                    placeholder: () => {
                      if (parameterName.val.includes('Percentage') || parameterName.val.includes('Threshold')) {
                        return 'Enter in basis points (e.g., 2000 = 20%)'
                      }
                      if (parameterName.val === 'tokenPrice') {
                        return 'Enter in ETH (e.g., 0.1)'
                      }
                      return 'Enter positive integer value'
                    },
                    value: () => parameterValue.val,
                    oninput: (e) => parameterValue.val = e.target.value
                  }),
                  () => {
                    if (parameterName.val.includes('Percentage') || parameterName.val.includes('Threshold')) {
                      return small({ class: 'text-muted' }, 'Basis points: 10000 = 100%, 2000 = 20%, 5100 = 51%')
                    }
                    if (parameterName.val === 'tokenPrice') {
                      return small({ class: 'text-muted' }, 'Current price: ' + daoState.info.val.tokenPrice + ' ETH')
                    }
                    return small({ class: 'text-muted' }, 'Enter a positive integer (no decimals)')
                  }
                ),
                button(
                  {
                    class: 'btn btn-primary w-100',
                    onclick: () => handleCreateProposal('parameter'),
                    disabled: () => isSubmitting.val
                  },
                  () => isSubmitting.val ? 'Creating...' : 'Create Parameter Proposal'
                )
              )

            default:
              return div('Select an action')
          }
        }
      )
    )
  )
}
