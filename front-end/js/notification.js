// notification.js - Handles notifications

/**
 * NotificationManager class to handle notifications
 */
export class NotificationManager {
    /**
     * Create a new NotificationManager instance
     */
    constructor() {
        this.notificationElement = document.getElementById('notification');
        this.messageElement = document.getElementById('notification-message');
        this.closeButton = document.getElementById('notification-close');
        
        // Setup close button
        this.closeButton.addEventListener('click', () => {
            this.hide();
        });
        
        // Setup auto-hide timer
        this.autoHideTimer = null;
    }
    
    /**
     * Show a notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {number} duration - Auto-hide duration in milliseconds (0 to disable)
     */
    show(message, type = 'info', duration = 5000) {
        // Clear existing timer
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
        
        // Set message
        this.messageElement.textContent = message;
        
        // Remove existing type classes
        this.notificationElement.classList.remove('success', 'error', 'warning', 'info');
        
        // Add type class
        this.notificationElement.classList.add(type);
        
        // Show notification
        this.notificationElement.style.display = 'block';
        
        // Set auto-hide timer if duration is specified
        if (duration > 0) {
            this.autoHideTimer = setTimeout(() => {
                this.hide();
            }, duration);
        }
    }
    
    /**
     * Hide the notification
     */
    hide() {
        this.notificationElement.style.display = 'none';
        
        // Clear timer
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
    }
    
    /**
     * Show a success notification
     * @param {string} message - Notification message
     * @param {number} duration - Auto-hide duration in milliseconds
     */
    success(message, duration = 5000) {
        this.show(message, 'success', duration);
    }
    
    /**
     * Show an error notification
     * @param {string} message - Notification message
     * @param {number} duration - Auto-hide duration in milliseconds
     */
    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    }
    
    /**
     * Show a warning notification
     * @param {string} message - Notification message
     * @param {number} duration - Auto-hide duration in milliseconds
     */
    warning(message, duration = 5000) {
        this.show(message, 'warning', duration);
    }
    
    /**
     * Show an info notification
     * @param {string} message - Notification message
     * @param {number} duration - Auto-hide duration in milliseconds
     */
    info(message, duration = 5000) {
        this.show(message, 'info', duration);
    }
}
