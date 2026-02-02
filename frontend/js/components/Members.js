// Members Component
// Shows governance token holders and their balances

// Global members state (created once at module load)
window.membersState = window.membersState || {
  members: van.state([]),
  isLoading: van.state(false),
  error: van.state(null),
  loaded: false
}

// Load members function (global)
window.loadMembers = async () => {
  const { members, isLoading, error } = window.membersState

  if (!walletState.isConnected.val || !walletState.daoContract.val) {
    console.warn('Cannot load members: not connected')
    return
  }

  isLoading.val = true
  error.val = null

  try {
      const daoContract = walletState.daoContract.val

      // Get list of token holders
      const holders = await daoContract.getGovernanceTokenHolders()

      // Get balances for each holder
      const memberData = []
      for (const holder of holders) {
        try {
          const [totalBalance, vestedBalance] = await Promise.all([
            daoContract.balanceOf(holder, 0), // Governance token ID is 0
            daoContract.vestedBalance(holder)
          ])

          const unvestedBalance = totalBalance - vestedBalance

          memberData.push({
            address: holder,
            totalBalance: totalBalance.toString(),
            vestedBalance: vestedBalance.toString(),
            unvestedBalance: unvestedBalance.toString()
          })
        } catch (err) {
          console.warn(`Error fetching balance for ${holder}:`, err)
        }
      }

      // Sort by total balance (descending)
      memberData.sort((a, b) => {
        return Number(BigInt(b.totalBalance) - BigInt(a.totalBalance))
      })

    members.val = memberData
    window.membersState.loaded = true
  } catch (err) {
    const message = err.message || 'Failed to load members'
    error.val = message
    console.error('Error loading members:', err)
  } finally {
    isLoading.val = false
  }
}

window.Members = () => {
  const { div, h3, p, table, thead, tbody, tr, th, td, small, span } = van.tags

  // Load members on mount if needed
  if (walletState.isConnected.val && window.membersState.members.val.length === 0 && !window.membersState.isLoading.val) {
    // Use setTimeout to avoid calling async function during render
    setTimeout(() => loadMembers(), 0)
  }

  return div(
    { class: 'container-fluid' },

    // Header
    div(
      { class: 'card mb-3' },
      div(
        { class: 'card-header' },
        h3({ class: 'mb-0' }, 'DAO Members')
      ),
      div(
        { class: 'card-body' },
        p({ class: 'text-muted mb-0' }, 'Governance token holders and their balances')
      )
    ),

    // Loading state
    () => {
      if (window.membersState.isLoading.val) {
        return div(
          { class: 'text-center py-5' },
          div({ class: 'spinner-border text-primary' }),
          p({ class: 'mt-2' }, 'Loading members...')
        )
      }
      return null
    },

    // Error state
    () => {
      if (window.membersState.error.val) {
        return div(
          { class: 'alert alert-danger' },
          window.membersState.error.val
        )
      }
      return null
    },

    // Members table
    () => {
      // Access both state values to establish dependencies
      const loading = window.membersState.isLoading.val
      const membersList = window.membersState.members.val

      if (loading) return null

      if (membersList.length === 0) {
        return div(
          { class: 'card' },
          div(
            { class: 'card-body text-center py-5' },
            p({ class: 'text-muted mb-0' }, 'No members found')
          )
        )
      }

      // Calculate totals
      const totalTokens = membersList.reduce((sum, m) => sum + BigInt(m.totalBalance), 0n)
      const totalVested = membersList.reduce((sum, m) => sum + BigInt(m.vestedBalance), 0n)
      const totalUnvested = membersList.reduce((sum, m) => sum + BigInt(m.unvestedBalance), 0n)

      return div(
        // Summary stats
        div(
          { class: 'row mb-3' },
          div(
            { class: 'col-md-4' },
            div(
              { class: 'card' },
              div(
                { class: 'card-body text-center' },
                h3({ class: 'mb-0' }, membersList.length),
                small({ class: 'text-muted' }, 'Total Members')
              )
            )
          ),
          div(
            { class: 'col-md-4' },
            div(
              { class: 'card' },
              div(
                { class: 'card-body text-center' },
                h3({ class: 'mb-0' }, formatAmount(totalTokens.toString())),
                small({ class: 'text-muted' }, 'Total Tokens')
              )
            )
          ),
          div(
            { class: 'col-md-4' },
            div(
              { class: 'card' },
              div(
                { class: 'card-body text-center' },
                h3({ class: 'mb-0' }, formatAmount(totalVested.toString())),
                small({ class: 'text-muted' }, 'Vested Tokens')
              )
            )
          )
        ),

        // Members table
        div(
          { class: 'card' },
          div(
            { class: 'card-body' },
            table(
              { class: 'table table-hover' },
              thead(
                tr(
                  th('#'),
                  th('Address'),
                  th('Total Balance'),
                  th('Vested'),
                  th('Unvested'),
                  th('% of Supply')
                )
              ),
              tbody(
                membersList.map((member, index) => MemberRow({ member, index, totalSupply: totalTokens }))
              )
            )
          )
        )
      )
    }
  )
}

/**
 * Individual member row
 */
const MemberRow = ({ member, index, totalSupply }) => {
  const { tr, td, span, small, div } = van.tags

  const total = BigInt(member.totalBalance)
  const vested = BigInt(member.vestedBalance)
  const unvested = BigInt(member.unvestedBalance)

  const percentOfSupply = totalSupply > 0n
    ? Number(total * 10000n / totalSupply) / 100
    : 0

  // Highlight if this is the current user
  const isCurrentUser = member.address.toLowerCase() === walletState.walletAddress.val?.toLowerCase()

  return tr(
    { class: isCurrentUser ? 'table-active' : '' },
    td(index + 1),
    td(
      div(
        truncateAddress(member.address),
        isCurrentUser ? span({ class: 'badge bg-primary ms-2' }, 'You') : null
      ),
      small({ class: 'd-block text-muted' }, member.address)
    ),
    td(formatAmount(member.totalBalance)),
    td(
      span({ class: 'text-success' }, formatAmount(member.vestedBalance))
    ),
    td(
      unvested > 0n
        ? span({ class: 'text-warning' }, formatAmount(member.unvestedBalance))
        : span({ class: 'text-muted' }, '0')
    ),
    td(percentOfSupply.toFixed(2) + '%')
  )
}
