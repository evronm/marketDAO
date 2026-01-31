// Notification utilities for VanJS
// Adapted for VanJS state management

/**
 * Creates a notification object for VanJS state
 */
window.createNotification = (message, type = 'info') => ({
  show: true,
  message,
  type, // 'info' | 'success' | 'warning' | 'danger'
})

/**
 * Creates an empty/hidden notification
 */
window.hideNotification = () => ({
  show: false,
  message: '',
  type: 'info',
})

/**
 * Shows a notification with auto-hide
 * @param {van.State} notificationState - VanJS state object
 * @param {string} message
 * @param {string} type - Bootstrap alert type
 * @param {number} duration - milliseconds
 */
window.showNotificationWithTimeout = (
  notificationState,
  message,
  type = 'info',
  duration = CONFIG.ui.notificationDuration
) => {
  notificationState.val = createNotification(message, type)

  setTimeout(() => {
    notificationState.val = hideNotification()
  }, duration)
}
