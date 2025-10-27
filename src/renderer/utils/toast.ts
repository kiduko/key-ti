// Toast 알림 유틸리티

export function showStatus(message: string, type: 'success' | 'error' | 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" aria-label="닫기">×</button>
  `;

  container.appendChild(toast);

  const closeButton = toast.querySelector('.toast-close');
  const removeToast = () => {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  };

  if (closeButton) {
    closeButton.addEventListener('click', removeToast);
  }

  setTimeout(removeToast, 10000);
}
