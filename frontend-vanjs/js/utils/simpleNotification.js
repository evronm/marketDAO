// Simple notification system that bypasses VanJS reactivity
// Directly manipulates DOM for reliable notifications

window.showNotification = (message, type = 'info', duration = 3000) => {
  console.log('📢 Showing notification:', { message, type })

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
  notification.innerHTML = `
    <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" aria-label="Close"></button>
    </div>
  `

  // Add close handler
  const closeBtn = notification.querySelector('.btn-close')
  closeBtn.onclick = () => notification.remove()

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
