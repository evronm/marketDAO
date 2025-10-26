import React from 'react';
import { NotificationState } from '../types';

interface NotificationProps {
  notification: NotificationState;
}

export const Notification: React.FC<NotificationProps> = ({ notification }) => {
  if (!notification.show) return null;

  return (
    <div
      className={`position-fixed bottom-0 end-0 m-3 p-3 alert alert-${notification.type}`}
      style={{ zIndex: 1051 }}
    >
      {notification.message}
    </div>
  );
};
