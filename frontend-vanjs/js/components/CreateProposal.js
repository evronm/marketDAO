// CreateProposal Component
// Form to create proposals with the unified architecture

window.CreateProposal = () => {
  const { div, h3, label, input, textarea, select, option, button, p, small } = van.tags

  // Form state
  const proposalType = van.state('resolution')
  const description = van.state('')

  // Treasury form
  const treasuryRecipient = van.state('')
  const treasuryAmount = van.state('')

  // Mint form
  const mintRecipient = van.state('')
  const mintAmount = van.state('')

  // Parameter form
  const parameterName = van.state('supportThreshold')
  const parameterValue = van.state('')

  const isSubmitting = van.state(false)

  // Reset form
  const resetForm = () => {
    description.val = ''
    treasuryRecipient.val = ''
    treasuryAmount.val = ''
    mintRecipient.val = ''
    mintAmount.val = ''
    parameterValue.val = ''
  }

  // Handle create proposal
  const handleCreate = async () => {
    if (!description.val.trim()) {
      showNotification('Please enter a description', 'warning')
      return
    }

    isSubmitting.val = true
    try {
      await createProposal(
        proposalType.val,
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
      resetForm()

      // Reload proposals
      await loadAllProposals()
    } catch (err) {
      console.error('Create proposal error:', err)

      // Parse error message for better UX
      let errorMsg = 'Failed to create proposal'

      if (err.message.includes('execution reverted') || err.message.includes('require(false)')) {
        // Check if it's likely a vesting issue
        const vestedBalance = parseInt(daoState.info.val.vestedBalance || '0')
        if (vestedBalance === 0) {
          errorMsg = 'You need vested (unlocked) tokens to create proposals. Your tokens are still locked in vesting.'
        } else {
          errorMsg = 'Transaction rejected by contract. You may not have sufficient permissions or tokens.'
        }
      } else if (err.message.includes('user rejected')) {
        errorMsg = 'Transaction cancelled'
      } else if (err.message.includes('insufficient funds')) {
        errorMsg = 'Insufficient ETH for gas fees'
      } else {
        // Keep the original error if it's something else
        errorMsg = err.message || 'Failed to create proposal'
      }

      showNotification(errorMsg, 'danger')
    } finally {
      isSubmitting.val = false
    }
  }

  return div(
    { class: 'card' },
    div(
      { class: 'card-header' },
      h3({ class: 'mb-0' }, 'Create Proposal')
    ),
    div(
      { class: 'card-body' },

      // Check if user has vested tokens
      () => {
        const vestedBalance = parseInt(daoState.info.val.vestedBalance || '0')
        if (vestedBalance === 0) {
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

      // Proposal Type Selector
      div(
        { class: 'mb-3' },
        label({ class: 'form-label' }, 'Proposal Type'),
        select(
          {
            class: 'form-select',
            value: () => proposalType.val,
            onchange: (e) => proposalType.val = e.target.value
          },
          option({ value: 'resolution' }, 'Resolution (Statement Only)'),
          option({ value: 'treasury' }, 'Treasury Transfer (ETH)'),
          option({ value: 'mint' }, 'Mint Governance Tokens'),
          option({ value: 'parameter' }, 'Change Parameter')
        )
      ),

      // Description (common to all)
      div(
        { class: 'mb-3' },
        label({ class: 'form-label' }, 'Description'),
        textarea({
          class: 'form-control',
          rows: '3',
          placeholder: 'Describe your proposal...',
          value: () => description.val,
          oninput: (e) => description.val = e.target.value
        }),
        small({ class: 'text-muted' }, 'Explain what this proposal is for and why it should pass')
      ),

      // Type-specific fields
      () => {
        switch (proposalType.val) {
          case 'treasury':
            return div(
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
                })
              )
            )

          case 'mint':
            return div(
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
                })
              )
            )

          case 'parameter':
            return div(
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
                  option({ value: 'tokenPrice' }, 'Token Price (wei)')
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
                    return 'Enter new value'
                  },
                  value: () => parameterValue.val,
                  oninput: (e) => parameterValue.val = e.target.value
                }),
                () => {
                  if (parameterName.val.includes('Percentage') || parameterName.val.includes('Threshold')) {
                    return small({ class: 'text-muted' }, 'Basis points: 10000 = 100%, 2000 = 20%, 5100 = 51%')
                  }
                  return null
                }
              )
            )

          default:
            return p({ class: 'text-muted' }, 'A resolution proposal makes a statement but executes no on-chain actions.')
        }
      },

      // Submit button
      button(
        {
          class: 'btn btn-primary btn-lg w-100 mt-3',
          onclick: handleCreate,
          disabled: () => isSubmitting.val
        },
        () => isSubmitting.val ? 'Creating...' : 'Create Proposal'
      )
    )
  )
}
