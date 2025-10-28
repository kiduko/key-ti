import React from 'react';

interface EmptyStateProps {
  icon: string;
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message }) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <p>{message}</p>
    </div>
  );
};

export default EmptyState;
