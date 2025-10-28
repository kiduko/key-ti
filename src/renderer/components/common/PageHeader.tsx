import React from 'react';

interface PageHeaderProps {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, action }) => {
  return (
    <div className="page-header">
      <h2 className="section-title">{title}</h2>
      {action && (
        <button className="btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
};

export default PageHeader;
