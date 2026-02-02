// MarketDAO VanJS Frontend - Main App
// No build step, runs directly in browser

// Wait for all scripts to load
(function() {
  'use strict'

  // VanJS is loaded globally via CDN as window.van
  const { div, h1, h2, p, button, span, nav, ul, li, a } = van.tags

  // Active tab state
  const activeTab = van.state('dashboard')

  /**
   * Header Component
   */
  const Header = () => {
    return div(
      { class: 'app-header' },
      div(
        { class: 'd-flex justify-content-between align-items-center' },
        h1({ class: 'app-title' }, 'MarketDAO'),
        () => {
          if (!walletState.isConnected.val) {
            return button(
              {
                class: 'btn btn-primary',
                onclick: async () => {
                  try {
                    await connectWallet()
                    showNotification('Wallet connected successfully!', 'success')
                  } catch (err) {
                    showNotification(err.message, 'danger')
                  }
                }
              },
              'Connect Wallet'
            )
          }

          return div(
            { class: 'wallet-info' },
            span({ class: 'wallet-address' }, truncateAddress(walletState.walletAddress.val)),
            button(
              {
                class: 'btn btn-sm btn-outline-secondary',
                onclick: () => {
                  // For now, just refresh the page to disconnect
                  window.location.reload()
                }
              },
              'Disconnect'
            )
          )
        }
      )
    )
  }

  /**
   * Connect Wallet View (shown before wallet connection)
   */
  const ConnectWalletView = () => {
    return div(
      { class: 'card text-center' },
      div(
        { class: 'card-body' },
        h2({ class: 'card-title' }, 'Welcome to MarketDAO'),
        p({ class: 'card-text' }, 'A governance system with tradeable voting tokens'),
        p({ class: 'text-muted' }, `Network: ${CONFIG.network.name} (Chain ID: ${CONFIG.network.chainId})`),
        button(
          {
            class: 'btn btn-primary btn-lg',
            onclick: async () => {
              try {
                await connectWallet()
                showNotification('Wallet connected successfully!', 'success')
              } catch (err) {
                showNotification(err.message, 'danger')
              }
            }
          },
          'Connect Wallet'
        ),
        () => {
          if (walletState.error.val) {
            return div(
              { class: 'alert alert-danger mt-3' },
              walletState.error.val
            )
          }
          return null
        }
      )
    )
  }

  /**
   * Dashboard View
   */
  const DashboardView = () => {
    return Dashboard()
  }

  /**
   * Proposals View
   */
  const ProposalsView = () => {
    return ProposalList()
  }

  /**
   * Main Content - shows appropriate view based on state
   */
  const MainContent = () => {
    return () => {
      try {
        // Show connect wallet view if not connected
        if (!walletState.isConnected.val) {
          return ConnectWalletView()
        }

        // Show active tab content
        switch (activeTab.val) {
          case 'dashboard':
            return DashboardView()
          case 'proposals':
            return ProposalsView()
          case 'elections':
            return Elections()
          case 'history':
            return History()
          case 'members':
            return Members()
          default:
            return div('Unknown tab')
        }
      } catch (err) {
        console.error('Error rendering main content:', err)
        return div(
          { class: 'alert alert-danger m-3' },
          h2('Rendering Error'),
          p('An error occurred while rendering the page. Please refresh and try again.'),
          p({ class: 'text-muted small' }, err.message)
        )
      }
    }
  }

  /**
   * Main App Component
   */
  const App = () => {
    return div(
      { class: 'app-container' },
      Header(),
      // Navigation tabs (always shown)
      (() => {
        const tabs = [
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'proposals', label: 'Proposals' },
          { id: 'elections', label: 'Elections' },
          { id: 'history', label: 'History' },
          { id: 'members', label: 'Members' }
        ]

        return div(
          { class: 'mb-3' },
          nav(
            ul(
              { class: 'nav nav-tabs' },
              tabs.map(tab =>
                li(
                  { class: 'nav-item' },
                  a(
                    {
                      class: () => `nav-link ${activeTab.val === tab.id ? 'active' : ''}`,
                      href: '#',
                      onclick: (e) => {
                        e.preventDefault()
                        activeTab.val = tab.id
                      }
                    },
                    tab.label
                  )
                )
              )
            )
          )
        )
      })(),
      MainContent()
    )
  }

  /**
   * Refresh all data (call after mutations)
   */
  window.refreshAllData = async () => {
    try {
      await loadDAOInfo()
      await loadAllProposals()
    } catch (err) {
      console.error('Error refreshing data:', err)
      showNotification('Failed to refresh data: ' + err.message, 'danger')
    }
  }

  /**
   * Set up global error handlers
   */
  let errorHandlers = {
    unhandledrejection: null,
    error: null
  }

  const setupErrorHandlers = () => {
    // Clean up existing handlers first (prevent duplicates)
    cleanupErrorHandlers()

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason)
      showNotification(
        'An error occurred: ' + (event.reason?.message || 'Unknown error'),
        'danger'
      )
    }

    // Handle uncaught errors
    const handleError = (event) => {
      console.error('Uncaught error:', event.error)
      // Don't show notification for every error, just log it
      // (some errors are expected, like network issues)
    }

    // Store handler references
    errorHandlers.unhandledrejection = handleUnhandledRejection
    errorHandlers.error = handleError

    // Add listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)
  }

  /**
   * Clean up global error handlers
   */
  const cleanupErrorHandlers = () => {
    if (errorHandlers.unhandledrejection) {
      window.removeEventListener('unhandledrejection', errorHandlers.unhandledrejection)
      errorHandlers.unhandledrejection = null
    }
    if (errorHandlers.error) {
      window.removeEventListener('error', errorHandlers.error)
      errorHandlers.error = null
    }
  }

  /**
   * Clean up all resources (call on page unload)
   */
  window.cleanupApp = () => {
    cleanupErrorHandlers()
    cleanupEventListeners()  // Clean up blockchain event listeners
    disconnectWallet()  // This will also clean up MetaMask listeners
  }

  // Clean up on page unload
  window.addEventListener('beforeunload', cleanupApp)

  /**
   * Initialize app
   */
  const initApp = () => {
    // Set up error handlers first
    setupErrorHandlers()

    // Initialize wallet state
    initWalletState(van)

    // Initialize DAO state
    initDAOState(van)

    // Initialize proposals state
    initProposalsState(van)

    // Track loaded state to avoid re-loading on every reactive update
    let dataLoaded = false
    let lastWalletAddress = null
    let isLoadingData = false

    /**
     * Load initial data for a connected wallet
     * Extracted to separate async function to avoid promise floating
     */
    const loadInitialData = async (address) => {
      // Prevent concurrent loads
      if (isLoadingData) {
        return
      }

      isLoadingData = true

      try {
        // Load DAO info first
        await loadDAOInfo()

        // Then load proposals
        await loadAllProposals()

        // Initialize event listeners for real-time updates
        initializeEventListeners()

        // Mark as successfully loaded
        dataLoaded = true
        lastWalletAddress = address
      } catch (err) {
        console.error('❌ Error loading initial data:', err)
        showNotification('Failed to load data: ' + (err.message || 'Unknown error'), 'danger')

        // Don't set dataLoaded = false here to prevent infinite retry loops
        // User can manually refresh or reconnect wallet to retry
        daoState.error.val = err.message || 'Failed to load data'
      } finally {
        isLoadingData = false
      }
    }

    // Load initial data when wallet connects
    van.derive(() => {
      const isConnected = walletState.isConnected.val
      const currentAddress = walletState.walletAddress.val

      // Load data if:
      // 1. Wallet just connected AND
      // 2. Either we haven't loaded data yet, OR the wallet address changed
      if (isConnected && (!dataLoaded || currentAddress !== lastWalletAddress)) {
        // Call async function but don't await (van.derive can't be async)
        // The function handles its own errors internally
        loadInitialData(currentAddress)
      } else if (!isConnected) {
        // Reset loaded flag when disconnected
        dataLoaded = false
        lastWalletAddress = null
        isLoadingData = false

        // Clean up event listeners
        cleanupEventListeners()
      }
    })

    // Mount app
    van.add(document.getElementById('app'), App())
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp)
  } else {
    initApp()
  }

})()
