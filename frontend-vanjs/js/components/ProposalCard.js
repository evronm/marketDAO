// ProposalCard Component
// Displays a single proposal with its details and actions

window.ProposalCard = ({ proposal }) => {
  const { div, h5, p, span, small, button, input, badge } = van.tags

  // Local state for support amount
  const supportAmount = van.state('10')
  const isSupporting = van.state(false)
  const isTriggeringElection = van.state(false)

  // Handle add support
  const handleAddSupport = async () => {
    const amount = supportAmount.val
    if (!amount || parseInt(amount) <= 0) {
      showNotificationWithTimeout(
        window.notificationState,
        'Please enter a valid support amount',
        'warning'
      )
      return
    }

    isSupporting.val = true
    try {
      await supportProposal(proposal.address, amount)
      showNotificationWithTimeout(
        window.notificationState,
        'Support added successfully!',
        'success'
      )
    } catch (err) {
      console.error('Support error:', err)
      showNotificationWithTimeout(
        window.notificationState,
        err.message || 'Failed to add support',
        'danger'
      )
    } finally {
      isSupporting.val = false
    }
  }

  // Handle trigger election
  const handleTriggerElection = async () => {
    isTriggeringElection.val = true
    try {
      await triggerElection(proposal.address)
      showNotificationWithTimeout(
        window.notificationState,
        'Election triggered successfully!',
        'success'
      )
    } catch (err) {
      console.error('Trigger election error:', err)
      showNotificationWithTimeout(
        window.notificationState,
        err.message || 'Failed to trigger election',
        'danger'
      )
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
          badge({ class: `badge ${getBadgeClass(proposal.type)} me-2` }, proposal.type.toUpperCase()),
          () => proposal.isExpired ? badge({ class: 'badge bg-danger' }, 'EXPIRED') : null
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
                const supportThreshold = parseInt(daoState.info.val.supportThreshold)
                const tokenSupply = parseInt(daoState.info.val.tokenSupply)
                const required = Math.ceil((tokenSupply * supportThreshold) / 10000)
                const current = parseInt(proposal.supportTotal)
                const percent = tokenSupply > 0 ? Math.round((current / required) * 100) : 0

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
