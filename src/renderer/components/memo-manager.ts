// 메모장 관리 컴포넌트
import { MemoFile } from '../../shared/types.js';
import { showStatus } from '../utils/toast.js';

let memos: MemoFile[] = [];
let currentMemoId: string | null = null;

export function loadMemo() {
  const saved = localStorage.getItem('memos');
  if (saved) {
    memos = JSON.parse(saved);
  } else {
    const oldMemo = localStorage.getItem('memo');
    if (oldMemo) {
      memos = [{
        id: Date.now().toString(),
        name: '기본 메모',
        content: oldMemo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
      localStorage.setItem('memos', JSON.stringify(memos));
      localStorage.removeItem('memo');
    }
  }
  renderMemoFiles();
}

export function renderMemoFiles() {
  const filesList = document.getElementById('memoFilesList');
  if (!filesList) return;

  filesList.innerHTML = '';

  memos.forEach(memo => {
    const item = document.createElement('div');
    item.className = 'memo-file-item';
    if (memo.id === currentMemoId) {
      item.classList.add('active');
    }
    item.textContent = memo.name;
    item.onclick = () => openMemoFile(memo.id);
    filesList.appendChild(item);
  });
}

export function openMemoFile(id: string) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;

  currentMemoId = id;

  const editor = document.getElementById('memoEditor');
  const placeholder = document.getElementById('memoPlaceholder');
  const nameInput = document.getElementById('memoFileName') as HTMLInputElement;
  const textarea = document.getElementById('memoTextarea') as HTMLTextAreaElement;

  if (editor && placeholder && nameInput && textarea) {
    editor.style.display = 'block';
    placeholder.style.display = 'none';
    nameInput.value = memo.name;
    textarea.value = memo.content;
  }

  renderMemoFiles();
}

export function openNewMemoModal() {
  const modal = document.getElementById('newMemoModal');
  const input = document.getElementById('newMemoName') as HTMLInputElement;
  if (modal && input) {
    modal.classList.add('active');
    input.value = `메모 ${memos.length + 1}`;
    input.select();
  }
}

export function closeNewMemoModal() {
  const modal = document.getElementById('newMemoModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

export function saveMemo() {
  if (!currentMemoId) return;

  const memo = memos.find(m => m.id === currentMemoId);
  if (!memo) return;

  const nameInput = document.getElementById('memoFileName') as HTMLInputElement;
  const textarea = document.getElementById('memoTextarea') as HTMLTextAreaElement;

  if (nameInput && textarea) {
    memo.name = nameInput.value;
    memo.content = textarea.value;
    memo.updatedAt = new Date().toISOString();

    localStorage.setItem('memos', JSON.stringify(memos));
    renderMemoFiles();
    showStatus('메모가 저장되었습니다', 'success');
  }
}

export function deleteMemo() {
  if (!currentMemoId) return;

  if (!confirm('이 메모를 삭제하시겠습니까?')) return;

  memos = memos.filter(m => m.id !== currentMemoId);
  localStorage.setItem('memos', JSON.stringify(memos));

  currentMemoId = null;
  const editor = document.getElementById('memoEditor');
  const placeholder = document.getElementById('memoPlaceholder');
  if (editor && placeholder) {
    editor.style.display = 'none';
    placeholder.style.display = 'block';
  }

  renderMemoFiles();
  showStatus('메모가 삭제되었습니다', 'success');
}

export function handleNewMemoSubmit(e: Event) {
  e.preventDefault();

  const nameInput = document.getElementById('newMemoName') as HTMLInputElement;
  const name = nameInput.value.trim();
  if (!name) return;

  const newMemo: MemoFile = {
    id: Date.now().toString(),
    name: name,
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  memos.push(newMemo);
  localStorage.setItem('memos', JSON.stringify(memos));
  renderMemoFiles();
  openMemoFile(newMemo.id);
  closeNewMemoModal();
  showStatus('새 메모가 생성되었습니다', 'success');
}
