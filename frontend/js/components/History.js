// History Component
// Shows completed/ended proposals

window.History = () => {
  const { div, h3, h4, p, span, small, table, thead, tbody, tr, th, td } = van.tags

  return div(
    { class: 'container-fluid' },

    // Header
    div(
      { class: 'card mb-3' },
      div(
        { class: 'card-header' },
        h3({ class: 'mb-0' }, 'Proposal History')
      ),
      div(
        { class: 'card-body' },
        p({ class: 'text-muted mb-0' }, 'Completed, executed, and expired proposals')
      )
    ),

    // Loading state
    () => {
      if (proposalsState.isLoading.val) {
        return div(
          { class: 'text-center py-5' },
          div({ class: 'spinner-border text-primary' }),
          p({ class: 'mt-2' }, 'Loading history...')
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

    // History list
    () => {
      // Access both state values to establish dependencies
      const loading = proposalsState.isLoading.val
      const history = proposalsState.history.val

      if (loading) return null

      if (history.length === 0) {
        return div(
          { class: 'card' },
          div(
            { class: 'card-body text-center py-5' },
            p({ class: 'text-muted mb-0' }, 'No completed proposals yet')
          )
        )
      }

      return div(
        { class: 'card' },
        div(
          { class: 'card-body' },
          table(
            { class: 'table table-hover' },
            thead(
              tr(
                th('Description'),
                th('Type'),
                th('Status'),
                th('Result'),
                th('Votes')
              )
            ),
            tbody(
              history.map(proposal => HistoryRow({ proposal }))
            )
          )
        )
      )
    }
  )
}

/**
 * Individual history row
 */
const HistoryRow = ({ proposal }) => {
  const { tr, td, span, small, div } = van.tags

  // Determine status badge
  const getStatusBadge = () => {
    if (proposal.executed) {
      return span({ class: 'badge bg-success' }, 'Executed')
    }
    if (proposal.electionStatus === 'Ended') {
      return span({ class: 'badge bg-secondary' }, 'Ended')
    }
    if (proposal.isExpired) {
      return span({ class: 'badge bg-warning' }, 'Expired')
    }
    return span({ class: 'badge bg-info' }, 'Unknown')
  }

  // Get result text
  const getResult = () => {
    if (proposal.executed) {
      return span({ class: 'text-success' }, '✓ Executed')
    }
    if (proposal.result) {
      const isApproved = proposal.result.includes('APPROVED')
      return span(
        { class: isApproved ? 'text-success' : 'text-danger' },
        proposal.result
      )
    }
    if (proposal.isExpired && !proposal.electionTriggered) {
      return span({ class: 'text-muted' }, 'Expired without election')
    }
    return span({ class: 'text-muted' }, '-')
  }

  // Get vote summary
  const getVotes = () => {
    if (!proposal.electionTriggered || !proposal.votes) {
      return span({ class: 'text-muted' }, '-')
    }

    const yes = formatAmount(proposal.votes.yes)
    const no = formatAmount(proposal.votes.no)
    const total = BigInt(proposal.votes.yes) + BigInt(proposal.votes.no)

    if (total === 0n) {
      return span({ class: 'text-muted' }, 'No votes')
    }

    const yesPercent = Number(BigInt(proposal.votes.yes) * 10000n / total) / 100
    const noPercent = Number(BigInt(proposal.votes.no) * 10000n / total) / 100

    return div(
      div(
        small({ class: 'text-success' }, `YES: ${yes} (${yesPercent.toFixed(1)}%)`),
        ' / ',
        small({ class: 'text-danger' }, `NO: ${no} (${noPercent.toFixed(1)}%)`)
      )
    )
  }

  return tr(
    td(
      div(proposal.description),
      small({ class: 'text-muted' }, truncateAddress(proposal.proposer))
    ),
    td(
      span({ class: 'badge bg-info' }, proposal.type.toUpperCase())
    ),
    td(getStatusBadge()),
    td(getResult()),
    td(getVotes())
  )
}
