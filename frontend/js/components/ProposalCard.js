// ProposalCard Component
// Displays a single proposal with its details and actions

window.ProposalCard = ({ proposal }) => {
  const { div, h5, p, span, small, button, input } = van.tags

  // Local state for support amount
  const supportAmount = van.state('10')
  const isSupporting = van.state(false)
  const isTriggeringElection = van.state(false)

  // Handle add support
  const handleAddSupport = async () => {
    const amount = supportAmount.val

    // Validate amount
    if (!isValidAmount(amount)) {
      showNotification('Please enter a valid support amount (positive number)', 'warning')
      return
    }

    // Check against vested balance
    const vestedBalance = BigInt(daoState.info.val.vestedBalance || '0')
    const amountBigInt = BigInt(amount)

    if (vestedBalance === 0n) {
      showNotification('You have no vested tokens to add support. Please claim vested tokens first.', 'warning')
      return
    }

    if (amountBigInt > vestedBalance) {
      showNotification(
        `Insufficient vested balance. You have ${vestedBalance} vested tokens available.`,
        'warning'
      )
      return
    }

    isSupporting.val = true
    try {
      await supportProposal(proposal.address, amount)
      showNotification('Support added successfully!', 'success')
    } catch (err) {
      console.error('Support error:', err)
      const parsedError = parseContractError(err, 'support')
      showNotification(parsedError.message, 'danger')
    } finally {
      isSupporting.val = false
    }
  }

  // Handle trigger election
  const handleTriggerElection = async () => {
    isTriggeringElection.val = true
    try {
      await triggerElection(proposal.address)
      showNotification('Election triggered successfully!', 'success')
    } catch (err) {
      console.error('Trigger election error:', err)
      const parsedError = parseContractError(err, 'trigger')
      showNotification(parsedError.message, 'danger')
    } finally {
      isTriggeringElection.val = false
    }
  }

  // Get card border color based on type
  const getBorderClass = (type) => {
    const colors = {
      treasury: 'border-success',
      mint: 'border-warning',
      parameter: 'border-info',
      distribution: 'border-purple',
      resolution: 'border-primary',
      custom: 'border-secondary'
    }
    return colors[type] || 'border-primary'
  }

  // Get badge color based on type
  const getBadgeClass = (type) => {
    const colors = {
      treasury: 'bg-success',
      mint: 'bg-warning',
      parameter: 'bg-info',
      distribution: 'bg-purple',
      resolution: 'bg-primary',
      custom: 'bg-secondary'
    }
    return colors[type] || 'bg-primary'
  }

  // Render proposal details based on type
  const renderDetails = () => {
    const { type, details } = proposal

    if (type === 'treasury') {
      return div(
        p({ class: 'mb-1' },
          span({ class: 'fw-bold' }, 'Action: '),
          details.action || 'Treasury Transfer'
        ),
        p({ class: 'mb-1' },
          span({ class: 'fw-bold' }, 'Recipient: '),
          small({ class: 'text-monospace' }, truncateAddress(details.recipient))
        ),
        p({ class: 'mb-0' },
          span({ class: 'fw-bold' }, 'Amount: '),
          safeFormatEther(details.amount) + ' ETH'
        )
      )
    } else if (type === 'mint') {
      return div(
        p({ class: 'mb-1' },
          span({ class: 'fw-bold' }, 'Recipient: '),
          small({ class: 'text-monospace' }, truncateAddress(details.recipient))
        ),
        p({ class: 'mb-0' },
          span({ class: 'fw-bold' }, 'Amount: '),
          details.amount + ' tokens'
        )
      )
    } else if (type === 'parameter') {
      return div(
        p({ class: 'mb-1' },
          span({ class: 'fw-bold' }, 'Parameter: '),
          details.parameter
        ),
        p({ class: 'mb-0' },
          span({ class: 'fw-bold' }, 'New Value: '),
          details.newValue
        )
      )
    } else if (type === 'custom') {
      return div(
        p({ class: 'mb-1' },
          span({ class: 'fw-bold' }, 'Target: '),
          small({ class: 'text-monospace' }, truncateAddress(details.target))
        ),
        p({ class: 'mb-0' },
          span({ class: 'fw-bold' }, 'Custom execution'),
        )
      )
    }

    return null
  }

  return div(
    { class: `card mb-3 border-start border-4 ${getBorderClass(proposal.type)}` },
    div(
      { class: 'card-body' },
      // Header with type badge
      div(
        { class: 'd-flex justify-content-between align-items-start mb-2' },
        div(
          span({ class: `badge ${getBadgeClass(proposal.type)} me-2` }, proposal.type.toUpperCase()),
          () => proposal.isExpired ? span({ class: 'badge bg-danger' }, 'EXPIRED') : null
        ),
        small({ class: 'text-muted' },
          'Proposal: ', truncateAddress(proposal.address)
        )
      ),

      // Description
      h5({ class: 'card-title' }, proposal.description),

      // Details based on type
      renderDetails(),

      // Metadata
      div(
        { class: 'mt-3 pt-3 border-top' },
        div(
          { class: 'row text-sm' },
          div(
            { class: 'col-md-6' },
            p({ class: 'mb-1' },
              span({ class: 'text-muted' }, 'Proposer: '),
              small({ class: 'text-monospace' }, truncateAddress(proposal.proposer))
            ),
            p({ class: 'mb-1' },
              span({ class: 'text-muted' }, 'Created: Block '),
              proposal.createdAt
            )
          ),
          div(
            { class: 'col-md-6' },
            p({ class: 'mb-1' },
              span({ class: 'text-muted' }, 'Support: '),
              span({ class: 'fw-bold' }, proposal.supportTotal),
              ' tokens'
            ),
            () => {
              if (!proposal.isExpired && !proposal.electionTriggered) {
                // Use BigInt for precision-safe calculations
                const supportThreshold = BigInt(daoState.info.val.supportThreshold)
                const tokenSupply = BigInt(daoState.info.val.tokenSupply)
                const currentSupport = BigInt(proposal.supportTotal)

                // Calculate required support: (tokenSupply * supportThreshold) / 10000
                const required = (tokenSupply * supportThreshold) / 10000n

                // Calculate percentage: (current * 100) / required
                // Use Number() only for display percentage (safe because it's 0-100)
                let percent = 0
                if (required > 0n) {
                  const percentBigInt = (currentSupport * 100n) / required
                  percent = Number(percentBigInt)
                }

                return div(
                  { class: 'progress' + ' ' + 'mb-2', style: 'height: 20px;' },
                  div({
                    class: 'progress-bar',
                    style: `width: ${Math.min(percent, 100)}%`,
                    role: 'progressbar'
                  }, percent + '%')
                )
              }
              return null
            }
          )
        )
      ),

      // Actions
      () => {
        if (proposal.isExpired) {
          return div(
            { class: 'alert alert-warning mt-3 mb-0' },
            'This proposal has expired and cannot proceed to election.'
          )
        }

        if (proposal.electionTriggered) {
          return div(
            { class: 'alert alert-info mt-3 mb-0' },
            'Election Status: ', proposal.electionStatus
          )
        }

        // Support actions
        return div(
          { class: 'mt-3' },
          div(
            { class: 'row align-items-end' },
            div(
              { class: 'col-md-6' },
              input({
                type: 'number',
                class: 'form-control',
                placeholder: 'Support amount',
                min: '1',
                value: () => supportAmount.val,
                oninput: (e) => supportAmount.val = e.target.value
              })
            ),
            div(
              { class: 'col-md-3' },
              button(
                {
                  class: 'btn btn-primary w-100',
                  onclick: handleAddSupport,
                  disabled: () => isSupporting.val
                },
                () => isSupporting.val ? 'Adding...' : 'Add Support'
              )
            ),
            div(
              { class: 'col-md-3' },
              () => {
                if (proposal.canTriggerElection) {
                  return button(
                    {
                      class: 'btn btn-success w-100',
                      onclick: handleTriggerElection,
                      disabled: () => isTriggeringElection.val
                    },
                    () => isTriggeringElection.val ? 'Starting...' : '🗳️ Start Election'
                  )
                }
                return null
              }
            )
          )
        )
      }
    )
  )
}
