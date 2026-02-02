// Simple notification system that bypasses VanJS reactivity
// Directly manipulates DOM for reliable notifications

window.showNotification = (message, type = 'info', duration = 3000) => {
  // Remove any existing notification
  const existing = document.getElementById('simple-notification')
  if (existing) {
    existing.remove()
  }

  // Create notification element
  const notification = document.createElement('div')
  notification.id = 'simple-notification'
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `

  const alertClass = `alert-${type}`

  // Create alert structure safely (avoiding XSS)
  const alertDiv = document.createElement('div')
  alertDiv.className = `alert ${alertClass} alert-dismissible fade show`
  alertDiv.setAttribute('role', 'alert')

  // Set message as text (auto-escapes HTML)
  alertDiv.textContent = message

  // Add close button
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'btn-close'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.onclick = () => notification.remove()

  alertDiv.appendChild(closeBtn)
  notification.appendChild(alertDiv)

  // Add to document
  document.body.appendChild(notification)

  // Auto-remove after duration
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove()
    }
  }, duration)
}

// Add slide-in animation
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`
document.head.appendChild(style)
