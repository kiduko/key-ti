// 링크 관리 컴포넌트
import { Link } from '../../shared/types';
import { showStatus } from '../utils/toast';

let links: Link[] = [];

export function loadLinks() {
  const saved = localStorage.getItem('links');
  if (saved) {
    links = JSON.parse(saved);
  }
  renderLinks();
}

export function renderLinks() {
  const linksList = document.getElementById('linksList');
  if (!linksList) return;

  linksList.innerHTML = '';

  links.forEach((link, index) => {
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    linkItem.innerHTML = `
      <div class="link-name">${link.name}</div>
      <div class="link-url">${link.url}</div>
      <button class="btn-delete link-delete" onclick="window.deleteLink(${index})">삭제</button>
    `;
    linkItem.onclick = (e) => {
      if ((e.target as HTMLElement).classList.contains('btn-delete')) return;
      window.electronAPI.openUrl(link.url);
    };
    linksList.appendChild(linkItem);
  });

  const addBtn = document.createElement('div');
  addBtn.className = 'add-link-btn';
  addBtn.textContent = '+ 링크 추가';
  addBtn.onclick = () => openAddLinkModal();
  linksList.appendChild(addBtn);
}

export function openAddLinkModal() {
  const modal = document.getElementById('linkModal');
  if (modal) {
    modal.classList.add('active');
    const form = document.getElementById('linkForm') as HTMLFormElement;
    if (form) {
      form.reset();
    }
  }
}

export function closeLinkModal() {
  const modal = document.getElementById('linkModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

export function deleteLink(index: number) {
  if (confirm('이 링크를 삭제하시겠습니까?')) {
    links.splice(index, 1);
    localStorage.setItem('links', JSON.stringify(links));
    renderLinks();
    showStatus('링크가 삭제되었습니다', 'success');
  }
}

export function handleLinkFormSubmit(e: Event) {
  e.preventDefault();

  const nameInput = document.getElementById('linkName') as HTMLInputElement;
  const urlInput = document.getElementById('linkUrl') as HTMLInputElement;

  const link: Link = {
    name: nameInput.value,
    url: urlInput.value
  };

  links.push(link);
  localStorage.setItem('links', JSON.stringify(links));
  renderLinks();
  closeLinkModal();
  showStatus('링크가 추가되었습니다', 'success');
}
