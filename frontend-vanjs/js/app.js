// MarketDAO VanJS Frontend - Main App
// No build step, runs directly in browser

// Wait for all scripts to load
(function() {
  'use strict'

  // VanJS is loaded globally via CDN as window.van
  const { div, h1, h2, p, button, span, nav, ul, li, a } = van.tags

  // Initialize notification state (expose globally for components)
  window.notificationState = van.state({ show: false, message: '', type: 'info' })
  const notification = window.notificationState

  // Active tab state
  const activeTab = van.state('dashboard')

  /**
   * Notification Component
   */
  const Notification = () => {
    return () => {
      const notif = notification.val
      if (!notif.show) return null

      return div(
        { class: 'notification-container' },
        div(
          { class: `alert alert-${notif.type} alert-dismissible fade show`, role: 'alert' },
          notif.message,
          button(
            {
              type: 'button',
              class: 'btn-close',
              onclick: () => notification.val = { show: false, message: '', type: 'info' }
            }
          )
        )
      )
    }
  }

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
                    showNotificationWithTimeout(notification, 'Wallet connected successfully!', 'success')
                  } catch (err) {
                    showNotificationWithTimeout(notification, err.message, 'danger')
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
   * Navigation Tabs Component
   */
  const Navigation = () => {
    const tabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'proposals', label: 'Proposals' },
      { id: 'elections', label: 'Elections' },
      { id: 'history', label: 'History' },
      { id: 'members', label: 'Members' }
    ]

    return nav(
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
                showNotificationWithTimeout(notification, 'Wallet connected successfully!', 'success')
              } catch (err) {
                showNotificationWithTimeout(notification, err.message, 'danger')
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
   * Proposals View (placeholder)
   */
  const ProposalsView = () => {
    return div(
      div(
        { class: 'card' },
        div(
          { class: 'card-header' },
          'Active Proposals'
        ),
        div(
          { class: 'card-body' },
          p('Proposals list coming soon...'),
          p({ class: 'text-muted' }, 'This will show all active proposals that need support.')
        )
      )
    )
  }

  /**
   * Main Content - shows appropriate view based on state
   */
  const MainContent = () => {
    return () => {
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
          return div(
            { class: 'card' },
            div({ class: 'card-body' }, 'Elections view coming soon...')
          )
        case 'history':
          return div(
            { class: 'card' },
            div({ class: 'card-body' }, 'History view coming soon...')
          )
        case 'members':
          return div(
            { class: 'card' },
            div({ class: 'card-body' }, 'Members view coming soon...')
          )
        default:
          return div('Unknown tab')
      }
    }
  }

  /**
   * Main App Component
   */
  const App = () => {
    return div(
      { class: 'app-container' },
      Notification(),
      Header(),
      () => walletState.isConnected.val ? Navigation() : null,
      MainContent()
    )
  }

  /**
   * Initialize app
   */
  const initApp = () => {
    console.log('Initializing MarketDAO frontend...')
    console.log('Config:', CONFIG)

    // Initialize wallet state
    initWalletState(van)

    // Initialize DAO state
    initDAOState(van)

    // Load DAO info when wallet connects
    van.derive(() => {
      if (walletState.isConnected.val && daoState.info.val.name === 'Loading...') {
        console.log('Wallet connected, loading DAO info...')
        loadDAOInfo()
      }
    })

    // Mount app
    van.add(document.getElementById('app'), App())

    console.log('✅ App initialized')
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp)
  } else {
    initApp()
  }

})()
