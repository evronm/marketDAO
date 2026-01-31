// Dashboard Component
// Displays DAO info, user balances, and token operations

window.Dashboard = () => {
  const { div, h3, h5, p, button, input, label, span, small } = van.tags

  // Local state for purchase amount
  const purchaseAmount = van.state('1')
  const isPurchasing = van.state(false)
  const isClaiming = van.state(false)

  // Handle purchase tokens
  const handlePurchase = async () => {
    const amount = parseInt(purchaseAmount.val)
    if (isNaN(amount) || amount <= 0) {
      showNotificationWithTimeout(
        window.notificationState,
        'Please enter a valid amount',
        'warning'
      )
      return
    }

    isPurchasing.val = true
    try {
      await purchaseTokens(amount)
      showNotificationWithTimeout(
        window.notificationState,
        `Successfully purchased ${amount} token(s)!`,
        'success'
      )
      purchaseAmount.val = '1' // Reset
    } catch (err) {
      console.error('Purchase error:', err)
      showNotificationWithTimeout(
        window.notificationState,
        err.message || 'Failed to purchase tokens',
        'danger'
      )
    } finally {
      isPurchasing.val = false
    }
  }

  // Handle claim vested tokens
  const handleClaim = async () => {
    isClaiming.val = true
    try {
      await claimVestedTokens()
      showNotificationWithTimeout(
        window.notificationState,
        'Successfully claimed vested tokens!',
        'success'
      )
    } catch (err) {
      console.error('Claim error:', err)
      showNotificationWithTimeout(
        window.notificationState,
        err.message || 'Failed to claim vested tokens',
        'danger'
      )
    } finally {
      isClaiming.val = false
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
            // Parameters Section
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

    // Actions Card
    div(
      { class: 'card' },
      div(
        { class: 'card-header' },
        h5({ class: 'mb-0' }, 'Actions')
      ),
      div(
        { class: 'card-body' },
        // Purchase Tokens Section
        div(
          { class: 'mb-4' },
          h5({ class: 'mb-3' }, 'Purchase Tokens'),
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
        ),

        // Claim Vested Tokens Section
        () => {
          if (!daoState.info.val.hasClaimableVesting) return null

          return div(
            { class: 'alert alert-info' },
            div(
              { class: 'd-flex justify-content-between align-items-center' },
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
          )
        }
      )
    )
  )
}
