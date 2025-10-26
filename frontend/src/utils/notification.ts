import { NotificationType, NotificationState } from '../types';
import { NOTIFICATION_DURATION } from '../types/constants';

/**
 * Creates a notification state object
 */
export const createNotification = (
  message: string,
  type: NotificationType = 'info'
): NotificationState => ({
  show: true,
  message,
  type,
});

/**
 * Creates an empty/hidden notification state
 */
export const hideNotification = (): NotificationState => ({
  show: false,
  message: '',
  type: 'info',
});

/**
 * Helper to show a notification with auto-hide
 */
export const showNotificationWithTimeout = (
  setNotification: (notification: NotificationState) => void,
  message: string,
  type: NotificationType = 'info',
  duration: number = NOTIFICATION_DURATION
): void => {
  setNotification(createNotification(message, type));

  setTimeout(() => {
    setNotification(hideNotification());
  }, duration);
};
