import React, { useState, useEffect } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  hiding: boolean;
}

let toastIdCounter = 0;
const toasts: Toast[] = [];
let updateToasts: (() => void) | null = null;

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toast: Toast = {
    id: toastIdCounter++,
    message,
    type,
    hiding: false,
  };

  toasts.push(toast);
  if (updateToasts) updateToasts();

  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === toast.id);
    if (index !== -1) {
      toasts[index].hiding = true;
      if (updateToasts) updateToasts();

      setTimeout(() => {
        const idx = toasts.findIndex((t) => t.id === toast.id);
        if (idx !== -1) {
          toasts.splice(idx, 1);
          if (updateToasts) updateToasts();
        }
      }, 300);
    }
  }, 3000);
};

const ToastContainer: React.FC = () => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    updateToasts = () => forceUpdate((n) => n + 1);
    return () => {
      updateToasts = null;
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type} ${toast.hiding ? 'hiding' : ''}`}
        >
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✗'}
            {toast.type === 'info' && 'ℹ'}
          </div>
          <div className="toast-message">{toast.message}</div>
          <button
            className="toast-close"
            onClick={() => {
              const index = toasts.findIndex((t) => t.id === toast.id);
              if (index !== -1) {
                toasts.splice(index, 1);
                forceUpdate((n) => n + 1);
              }
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
