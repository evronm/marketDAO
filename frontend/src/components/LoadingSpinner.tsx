import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Processing Blockchain Request...' }) => {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1050,
      }}
    >
      <div className="bg-white p-4 rounded shadow text-center">
        <div className="spinner mx-auto mb-3"></div>
        <div className="fw-bold">{message}</div>
        <div className="text-muted small">Please wait for completion</div>
      </div>
    </div>
  );
};
