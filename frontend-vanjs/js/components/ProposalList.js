// ProposalList Component
// Displays list of active proposals

window.ProposalList = () => {
  const { div, h5, p, button } = van.tags

  return div(
    // Header with refresh button
    div(
      { class: 'card mb-3' },
      div(
        { class: 'card-header d-flex justify-content-between align-items-center' },
        h5({ class: 'mb-0' }, 'Active Proposals'),
        button(
          {
            class: 'btn btn-sm btn-outline-primary',
            onclick: loadAllProposals,
            disabled: () => proposalsState.isLoading.val
          },
          () => proposalsState.isLoading.val ? 'Loading...' : '🔄 Refresh'
        )
      )
    ),

    // Error message
    () => {
      if (proposalsState.error.val) {
        return div(
          { class: 'alert alert-danger' },
          'Error loading proposals: ', proposalsState.error.val
        )
      }
      return null
    },

    // Loading state
    () => {
      if (proposalsState.isLoading.val) {
        return div(
          { class: 'text-center py-5' },
          div({ class: 'spinner-border text-primary', role: 'status' }),
          p({ class: 'mt-2' }, 'Loading proposals...')
        )
      }
      return null
    },

    // Proposals list
    () => {
      if (proposalsState.isLoading.val) return null

      const proposals = proposalsState.active.val

      if (proposals.length === 0) {
        return div(
          { class: 'card' },
          div(
            { class: 'card-body text-center py-5' },
            p({ class: 'text-muted' }, 'No active proposals'),
            p({ class: 'text-muted small' }, 'Create a new proposal to get started')
          )
        )
      }

      return div(
        proposals.map(proposal => ProposalCard({ proposal }))
      )
    }
  )
}
