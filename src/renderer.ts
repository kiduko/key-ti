interface AWSProfile {
  alias: string;
  profileName: string;
  roleArn: string;
  samlUrl: string;
  idp: string;
  lastRefresh?: string;
  expiration?: string;
  isActive?: boolean;
  otpAccountId?: string;
}

interface OTPAccount {
  id: string;
  name: string;
  issuer?: string;
  secret: string;
  algorithm?: 'sha1' | 'sha256' | 'sha512';
  digits?: number;
  period?: number;
}

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      getProfiles: () => Promise<AWSProfile[]>;
      addProfile: (profile: AWSProfile) => Promise<void>;
      updateProfile: (alias: string, profile: AWSProfile) => Promise<void>;
      deleteProfile: (alias: string) => Promise<void>;
      activateProfile: (alias: string) => Promise<{ success: boolean; message: string }>;
      deactivateProfile: (alias: string) => Promise<{ success: boolean; message: string }>;
      getActiveProfile: () => Promise<string | undefined>;
      validateSessions: () => Promise<{ success: boolean }>;
      openConsole: (alias: string) => Promise<{ success: boolean; message: string }>;
      openUrl: (url: string) => Promise<void>;
      getBackupPath: () => Promise<string>;
      testBackupPath: () => Promise<{ success: boolean; message?: string }>;
      saveBackup: (data: any) => Promise<{ success: boolean; filename?: string; message?: string }>;
      listBackups: () => Promise<{ success: boolean; backups: any[] }>;
      loadBackup: (filename: string) => Promise<{ success: boolean; data?: any; message?: string }>;
      getAutoBackupSettings: () => Promise<{ enabled: boolean; type: string }>;
      getAutoRefreshSettings: () => Promise<{ enabled: boolean; timing: number; silent: boolean }>;
      setAutoRefreshSettings: (settings: { enabled: boolean; timing: number; silent: boolean }) => Promise<{ success: boolean }>;
      onUpdateAvailable: (callback: (version: string) => void) => void;
      getOTPAccounts: () => Promise<OTPAccount[]>;
      addOTPAccount: (account: OTPAccount) => Promise<{ success: boolean }>;
      updateOTPAccount: (id: string, account: OTPAccount) => Promise<{ success: boolean }>;
      deleteOTPAccount: (id: string) => Promise<{ success: boolean }>;
      generateOTPCode: (account: OTPAccount) => Promise<{ success: boolean; token?: string; timeRemaining?: number; error?: string }>;
      showOTPWindow: (account: OTPAccount) => Promise<{ success: boolean }>;
      closeOTPWindow: () => Promise<{ success: boolean }>;
    };
  }
}

let profiles: AWSProfile[] = [];
let activeProfile: string | undefined;
let timerInterval: any = null;
let editingAlias: string | null = null;

// 시간 계산 및 포맷팅 헬퍼 함수
function calculateTimeRemaining(expirationStr: string): {
  seconds: number;
  text: string;
  className: string;
} {
  const expiration = new Date(expirationStr);
  const now = new Date();
  const timeRemainingSeconds = Math.floor((expiration.getTime() - now.getTime()) / 1000);

  if (timeRemainingSeconds <= 0) {
    return {
      seconds: 0,
      text: '만료됨',
      className: 'time-expired'
    };
  }

  const hours = Math.floor(timeRemainingSeconds / 3600);
  const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
  const seconds = timeRemainingSeconds % 60;

  let className = 'time-normal';
  if (timeRemainingSeconds < 300) { // 5분 미만
    className = 'time-critical';
  } else if (timeRemainingSeconds < 3600) { // 1시간 미만
    className = 'time-warning';
  }

  return {
    seconds: timeRemainingSeconds,
    text: `${hours}시간 ${minutes}분 ${seconds}초`,
    className
  };
}

async function loadProfiles() {
  console.log('Renderer: Loading profiles...');

  // 세션 검증 먼저 수행
  await window.electronAPI.validateSessions();

  profiles = await window.electronAPI.getProfiles();
  activeProfile = await window.electronAPI.getActiveProfile();
  console.log('Renderer: Loaded profiles:', profiles);
  console.log('Renderer: Active profile:', activeProfile);
  renderProfiles();
}

function renderProfiles() {
  const profilesList = document.getElementById('profilesList')!;

  if (profiles.length === 0) {
    profilesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>등록된 프로필이 없습니다</p>
      </div>
    `;
    return;
  }

  profilesList.innerHTML = profiles
    .map(
      profile => {
        const isActive = profile.isActive || false;
        let expirationText = '';

        if (profile.expiration) {
          const timeInfo = calculateTimeRemaining(profile.expiration);
          expirationText = `<span class="${timeInfo.className}" data-expiration="${profile.expiration}" onclick="activateProfile('${profile.alias}')" style="cursor: pointer; text-decoration: underline;">
            ${timeInfo.text}
          </span>`;
        }

        return `
    <div class="profile-item ${isActive ? 'profile-active' : ''}" style="${isActive ? 'background: #e8f4f8; border-left: 4px solid #5a6c7d;' : ''}">
      <div class="profile-info">
        <div class="profile-alias">
          ${profile.alias} ${isActive ? '<span style="color: #5a6c7d;">●</span>' : ''}
          <button class="btn-delete" onclick="deleteProfile('${profile.alias}')" title="삭제">🗑️</button>
        </div>
        <div class="profile-details">
          <strong>Profile:</strong> ${profile.profileName} | <strong>Role:</strong> ${profile.roleArn.split('/').pop()}
          ${expirationText ? '<br>남은 시간: ' + expirationText : ''}
        </div>
      </div>
      <div class="profile-actions">
        ${isActive ? `
          <button class="btn-secondary" onclick="openConsole('${profile.alias}')">🌐 콘솔</button>
          <button class="btn-secondary" onclick="editProfile('${profile.alias}')">✏️ 편집</button>
          <button class="btn-danger" onclick="deactivateProfile('${profile.alias}')">
            로그아웃
          </button>
        ` : `
          <button class="btn-success" onclick="activateProfile('${profile.alias}')">
            로그인
          </button>
          <button class="btn-secondary" onclick="editProfile('${profile.alias}')">✏️ 편집</button>
        `}
      </div>
    </div>
  `;
      }
    )
    .join('');

  // 실시간 타이머 시작
  startTimer();
}

async function populateOTPAccountsDropdown() {
  const select = document.getElementById('otpAccountId') as HTMLSelectElement;
  if (!select) return;

  const accounts = await window.electronAPI.getOTPAccounts();

  // 기본 옵션 유지하고 나머지 제거
  select.innerHTML = '<option value="">연결 안 함</option>';

  // OTP 계정 옵션 추가
  accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = `${account.name}${account.issuer ? ` (${account.issuer})` : ''}`;
    select.appendChild(option);
  });
}

async function openAddProfileModal() {
  editingAlias = null;
  const modal = document.getElementById('profileModal')!;
  const modalHeader = modal.querySelector('.modal-header')!;
  modalHeader.textContent = '프로필 추가';

  const form = document.getElementById('profileForm') as HTMLFormElement;
  form.reset();

  // alias 필드 활성화
  (document.getElementById('alias') as HTMLInputElement).disabled = false;

  // OTP 계정 목록 채우기
  await populateOTPAccountsDropdown();

  modal.classList.add('active');
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal')!;
  modal.classList.remove('active');
  editingAlias = null;
}

async function editProfile(alias: string) {
  const profile = profiles.find(p => p.alias === alias);
  if (!profile) return;

  // 활성 세션이 있으면 먼저 로그아웃 확인
  if (profile.isActive) {
    const shouldLogout = confirm(
      `"${alias}" 프로필을 편집하려면 먼저 로그아웃해야 합니다.\n로그아웃하고 편집하시겠습니까?`
    );

    if (!shouldLogout) return;

    // 자동 로그아웃
    showStatus('세션 로그아웃 중...', 'info');
    const result = await window.electronAPI.deactivateProfile(alias);

    if (!result.success) {
      showStatus('로그아웃 실패: ' + result.message, 'error');
      return;
    }

    await loadProfiles();
  }

  // 편집 모드로 모달 열기
  editingAlias = alias;
  const modal = document.getElementById('profileModal')!;
  const modalHeader = modal.querySelector('.modal-header')!;
  modalHeader.textContent = '프로필 편집';

  const form = document.getElementById('profileForm') as HTMLFormElement;

  // OTP 계정 목록 채우기
  await populateOTPAccountsDropdown();

  // 기존 데이터 채우기
  (document.getElementById('alias') as HTMLInputElement).value = profile.alias;
  (document.getElementById('alias') as HTMLInputElement).disabled = true; // alias는 수정 불가
  (document.getElementById('profileName') as HTMLInputElement).value = profile.profileName;
  (document.getElementById('roleArn') as HTMLInputElement).value = profile.roleArn;
  (document.getElementById('samlUrl') as HTMLInputElement).value = profile.samlUrl;
  (document.getElementById('idp') as HTMLInputElement).value = profile.idp;
  (document.getElementById('otpAccountId') as HTMLSelectElement).value = profile.otpAccountId || '';

  modal.classList.add('active');
}

async function deleteProfile(alias: string) {
  if (!confirm(`"${alias}" 프로필을 삭제하시겠습니까?`)) {
    return;
  }

  await window.electronAPI.deleteProfile(alias);
  await loadProfiles();
  showStatus('프로필이 삭제되었습니다', 'success');
}

// OTP 패널 관련 변수
let otpPanelInterval: any = null;
let currentOTPAccount: OTPAccount | null = null;

function showOTPDisplayPanel(account: OTPAccount) {
  currentOTPAccount = account;

  const panel = document.getElementById('otpDisplayPanel');
  const title = document.getElementById('otpDisplayTitle');
  const issuer = document.getElementById('otpDisplayIssuer');

  if (panel && title && issuer) {
    title.textContent = account.name;
    issuer.textContent = account.issuer || '';

    panel.classList.add('visible');

    // OTP 코드 업데이트 시작
    updateOTPDisplay();
    if (otpPanelInterval) {
      clearInterval(otpPanelInterval);
    }
    otpPanelInterval = setInterval(updateOTPDisplay, 1000);
  }
}

async function updateOTPDisplay() {
  if (!currentOTPAccount) return;

  const result = await window.electronAPI.generateOTPCode(currentOTPAccount);
  const codeEl = document.getElementById('otpDisplayCode');
  const timerEl = document.getElementById('otpDisplayTimer');

  if (codeEl && timerEl && result.success) {
    codeEl.textContent = result.token || '------';
    timerEl.textContent = `${result.timeRemaining || 0}s`;
  }
}

function closeOTPDisplayPanel() {
  const panel = document.getElementById('otpDisplayPanel');
  if (panel) {
    panel.classList.remove('visible');
  }

  if (otpPanelInterval) {
    clearInterval(otpPanelInterval);
    otpPanelInterval = null;
  }

  currentOTPAccount = null;
}

async function copyOTPCodeFromDisplay() {
  const codeEl = document.getElementById('otpDisplayCode');
  if (codeEl && codeEl.textContent && codeEl.textContent !== '------') {
    await navigator.clipboard.writeText(codeEl.textContent);
    showStatus('OTP 코드가 복사되었습니다', 'success');
  }
}

(window as any).closeOTPDisplayPanel = closeOTPDisplayPanel;
(window as any).copyOTPCodeFromDisplay = copyOTPCodeFromDisplay;

async function activateProfile(alias: string) {
  const profile = profiles.find(p => p.alias === alias);

  let hasOTPWindow = false;

  // OTP 계정이 연결되어 있으면 새 창 표시
  if (profile && profile.otpAccountId) {
    const otpAccounts = await window.electronAPI.getOTPAccounts();
    const otpAccount = otpAccounts.find(a => a.id === profile.otpAccountId);

    if (otpAccount) {
      await window.electronAPI.showOTPWindow(otpAccount);
      hasOTPWindow = true;

      // 0.5초 대기 후 로그인 진행
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  showStatus('세션 활성화 중...', 'info');

  const result = await window.electronAPI.activateProfile(alias);

  // 로그인 완료 후 OTP 창 닫기
  if (hasOTPWindow) {
    await window.electronAPI.closeOTPWindow();
  }

  if (result.success) {
    await loadProfiles();
    showStatus(result.message, 'success');
  } else {
    showStatus(result.message, 'error');
  }
}

async function deactivateProfile(alias: string) {
  if (!confirm(`"${alias}" 세션을 로그아웃하시겠습니까?`)) {
    return;
  }

  showStatus('로그아웃 중...', 'info');

  const result = await window.electronAPI.deactivateProfile(alias);

  if (result.success) {
    await loadProfiles();
    showStatus(result.message, 'success');
  } else {
    showStatus(result.message, 'error');
  }
}

function startTimer() {
  // 기존 타이머 제거
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // 1초마다 남은 시간 업데이트
  timerInterval = setInterval(() => {
    const timeElements = document.querySelectorAll('[data-expiration]');

    timeElements.forEach((element) => {
      const expirationStr = element.getAttribute('data-expiration');
      if (!expirationStr) return;

      const timeInfo = calculateTimeRemaining(expirationStr);
      element.textContent = timeInfo.text;
      element.className = timeInfo.className;
    });
  }, 1000);
}

async function openConsole(alias: string) {
  showStatus('AWS 콘솔 열기 중...', 'info');

  const result = await window.electronAPI.openConsole(alias);

  if (result.success) {
    showStatus(result.message, 'success');
  } else {
    showStatus(result.message, 'error');
  }
}

// Expose functions to global scope for onclick handlers
(window as any).loadProfiles = loadProfiles;
(window as any).openAddProfileModal = openAddProfileModal;
(window as any).closeProfileModal = closeProfileModal;
(window as any).editProfile = editProfile;
(window as any).deleteProfile = deleteProfile;
(window as any).activateProfile = activateProfile;
(window as any).deactivateProfile = deactivateProfile;
(window as any).openConsole = openConsole;

// 다운로드 프로그레스 표시
function showDownloadProgress(percent: number) {
  const progressContainer = document.getElementById('downloadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');

  if (progressContainer && progressBar && progressPercent) {
    progressContainer.style.display = 'flex';
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
  }
}

// 다운로드 프로그레스 숨기기
function hideDownloadProgress() {
  const progressContainer = document.getElementById('downloadProgress');
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }
}

// window에 함수 노출
(window as any).showDownloadProgress = showDownloadProgress;
(window as any).hideDownloadProgress = hideDownloadProgress;

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  // 아이콘 선택
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  // Toast 생성
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" aria-label="닫기">×</button>
  `;

  container.appendChild(toast);

  // 닫기 버튼 클릭 이벤트
  const closeButton = toast.querySelector('.toast-close');
  const removeToast = () => {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300); // 애니메이션 시간
  };

  if (closeButton) {
    closeButton.addEventListener('click', removeToast);
  }

  // 10초 후 자동 제거 (3초 -> 10초로 변경)
  setTimeout(removeToast, 10000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing...');

  // 버전 정보 표시
  const version = await window.electronAPI.getAppVersion();
  const versionEl = document.getElementById('appVersion');
  if (versionEl) {
    versionEl.textContent = `v${version}`;
  }

  // 업데이트 알림 수신
  window.electronAPI.onUpdateAvailable((newVersion: string) => {
    if (versionEl) {
      versionEl.innerHTML = `v${version} <a href="#" id="updateLink" style="color: #4CAF50; text-decoration: none; margin-left: 8px;">🆕 v${newVersion} 업데이트</a>`;

      const updateLink = document.getElementById('updateLink');
      if (updateLink) {
        updateLink.addEventListener('click', (e) => {
          e.preventDefault();
          window.electronAPI.openUrl('https://github.com/kiduko/key-ti/releases/latest');
        });
      }
    }
  });

  // Form submission
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Form submitted');

      const otpAccountIdValue = (document.getElementById('otpAccountId') as HTMLSelectElement).value;

      const profile: AWSProfile = {
        alias: (document.getElementById('alias') as HTMLInputElement).value,
        profileName: (document.getElementById('profileName') as HTMLInputElement).value,
        roleArn: (document.getElementById('roleArn') as HTMLInputElement).value,
        samlUrl: (document.getElementById('samlUrl') as HTMLInputElement).value,
        idp: (document.getElementById('idp') as HTMLInputElement).value,
        otpAccountId: otpAccountIdValue || undefined
      };

      if (editingAlias) {
        // 편집 모드
        console.log('Updating profile:', profile);
        await window.electronAPI.updateProfile(editingAlias, profile);
        await loadProfiles();
        closeProfileModal();
        showStatus('프로필이 수정되었습니다', 'success');
      } else {
        // 추가 모드
        console.log('Adding profile:', profile);
        await window.electronAPI.addProfile(profile);
        await loadProfiles();
        closeProfileModal();
        showStatus('프로필이 추가되었습니다', 'success');
      }
    });
  } else {
    console.error('Profile form not found!');
  }

  // Close modal on background click
  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeProfileModal();
      }
    });
  }

  // Load profiles on page load
  loadProfiles();
  loadMemo();
  loadLinks();

  // 새 메모 폼 제출
  const newMemoForm = document.getElementById('newMemoForm');
  if (newMemoForm) {
    newMemoForm.addEventListener('submit', (e) => {
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
      (window as any).closeNewMemoModal();
      showStatus('새 메모가 생성되었습니다', 'success');
    });
  }

  // 새 메모 모달 배경 클릭 시 닫기
  const newMemoModal = document.getElementById('newMemoModal');
  if (newMemoModal) {
    newMemoModal.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        (window as any).closeNewMemoModal();
      }
    });
  }

  // 백업 복원 모달 배경 클릭 시 닫기
  const restoreModal = document.getElementById('restoreBackupModal');
  if (restoreModal) {
    restoreModal.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        (window as any).closeRestoreModal();
      }
    });
  }
});

// ========== 탭 전환 ==========
(window as any).switchTab = function(tabName: string) {
  // OTP 탭에서 벗어날 때 OTP 생성 중지
  if (tabName !== 'otp') {
    activeOTPId = null;
    if (otpUpdateInterval) {
      clearInterval(otpUpdateInterval);
      otpUpdateInterval = null;
    }
  }

  // 모든 탭과 탭 콘텐츠 비활성화
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  // 선택된 탭 활성화
  const tabs = document.querySelectorAll('.tab');
  if (tabName === 'sessions') {
    tabs[0].classList.add('active');
    document.getElementById('sessionsTab')?.classList.add('active');
  } else if (tabName === 'otp') {
    tabs[1].classList.add('active');
    document.getElementById('otpTab')?.classList.add('active');
    loadOTPAccounts();
  } else if (tabName === 'memo') {
    tabs[2].classList.add('active');
    document.getElementById('memoTab')?.classList.add('active');
  } else if (tabName === 'links') {
    tabs[3].classList.add('active');
    document.getElementById('linksTab')?.classList.add('active');
  } else if (tabName === 'settings') {
    tabs[4].classList.add('active');
    document.getElementById('settingsTab')?.classList.add('active');
    loadAutoRefreshSettings();
    loadBackupSettings();
  }
};

// ========== 설정 서브탭 전환 ==========
(window as any).switchSettingsSubTab = function(subTabName: string) {
  // 모든 서브탭과 콘텐츠 비활성화
  document.querySelectorAll('.settings-subtab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.settings-subtab-content').forEach(content => content.classList.remove('active'));

  // 선택된 서브탭 활성화
  const subtabs = document.querySelectorAll('.settings-subtab');
  if (subTabName === 'autoRefresh') {
    subtabs[0].classList.add('active');
    document.getElementById('autoRefreshSettingsTab')?.classList.add('active');
  } else if (subTabName === 'backup') {
    subtabs[1].classList.add('active');
    document.getElementById('backupSettingsTab')?.classList.add('active');
  }
};

// ========== 메모장 기능 (멀티 파일) ==========
interface MemoFile {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

let memos: MemoFile[] = [];
let currentMemoId: string | null = null;

function loadMemo() {
  const saved = localStorage.getItem('memos');
  if (saved) {
    memos = JSON.parse(saved);
  } else {
    // 기존 단일 메모 마이그레이션
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

function renderMemoFiles() {
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

function openMemoFile(id: string) {
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

(window as any).openNewMemoModal = function() {
  const modal = document.getElementById('newMemoModal');
  const input = document.getElementById('newMemoName') as HTMLInputElement;
  if (modal && input) {
    modal.classList.add('active');
    input.value = `메모 ${memos.length + 1}`;
    input.select();
  }
};

(window as any).closeNewMemoModal = function() {
  const modal = document.getElementById('newMemoModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

(window as any).saveMemo = function() {
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
};

(window as any).deleteMemo = function() {
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
};

// ========== 링크 기능 ==========
interface Link {
  name: string;
  url: string;
}

let links: Link[] = [];

function loadLinks() {
  const saved = localStorage.getItem('links');
  if (saved) {
    links = JSON.parse(saved);
  }
  renderLinks();
}

function renderLinks() {
  const linksList = document.getElementById('linksList');
  if (!linksList) return;

  linksList.innerHTML = '';

  links.forEach((link, index) => {
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item';
    linkItem.innerHTML = `
      <div class="link-name">${link.name}</div>
      <div class="link-url">${link.url}</div>
      <button class="btn-delete link-delete" onclick="deleteLink(${index})">삭제</button>
    `;
    linkItem.onclick = (e) => {
      if ((e.target as HTMLElement).classList.contains('btn-delete')) return;
      // URL 열기
      window.electronAPI.openUrl(link.url);
    };
    linksList.appendChild(linkItem);
  });

  // 링크 추가 버튼
  const addBtn = document.createElement('div');
  addBtn.className = 'add-link-btn';
  addBtn.textContent = '+ 링크 추가';
  addBtn.onclick = () => (window as any).openAddLinkModal();
  linksList.appendChild(addBtn);
}

(window as any).openAddLinkModal = function() {
  const modal = document.getElementById('linkModal');
  if (modal) {
    modal.classList.add('active');
    const form = document.getElementById('linkForm') as HTMLFormElement;
    if (form) {
      form.reset();
    }
  }
};

(window as any).closeLinkModal = function() {
  const modal = document.getElementById('linkModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

(window as any).deleteLink = function(index: number) {
  if (confirm('이 링크를 삭제하시겠습니까?')) {
    links.splice(index, 1);
    localStorage.setItem('links', JSON.stringify(links));
    renderLinks();
    showStatus('링크가 삭제되었습니다', 'success');
  }
};

// 링크 폼 제출
document.addEventListener('DOMContentLoaded', () => {
  const linkForm = document.getElementById('linkForm');
  if (linkForm) {
    linkForm.addEventListener('submit', (e) => {
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
      (window as any).closeLinkModal();
      showStatus('링크가 추가되었습니다', 'success');
    });
  }

  // Close link modal on background click
  const linkModal = document.getElementById('linkModal');
  if (linkModal) {
    linkModal.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        (window as any).closeLinkModal();
      }
    });
  }

  // 백업 타입 변경 이벤트
  const backupTypeSelect = document.getElementById('backupType');
  if (backupTypeSelect) {
    backupTypeSelect.addEventListener('change', (e) => {
      const type = (e.target as HTMLSelectElement).value;
      document.getElementById('localBackupSettings')!.style.display = type === 'local' ? 'block' : 'none';
    });
  }
});

// ========== 자동 갱신 설정 기능 ==========
async function loadAutoRefreshSettings() {
  const settings = await window.electronAPI.getAutoRefreshSettings();

  const enabledCheckbox = document.getElementById('autoRefreshEnabled') as HTMLInputElement;
  const timingSelect = document.getElementById('autoRefreshTiming') as HTMLSelectElement;
  const silentCheckbox = document.getElementById('autoRefreshSilent') as HTMLInputElement;

  if (enabledCheckbox) enabledCheckbox.checked = settings.enabled;
  if (timingSelect) timingSelect.value = settings.timing.toString();
  if (silentCheckbox) silentCheckbox.checked = settings.silent;
}

(window as any).saveAutoRefreshSettings = async function() {
  const enabledCheckbox = document.getElementById('autoRefreshEnabled') as HTMLInputElement;
  const timingSelect = document.getElementById('autoRefreshTiming') as HTMLSelectElement;
  const silentCheckbox = document.getElementById('autoRefreshSilent') as HTMLInputElement;

  const settings = {
    enabled: enabledCheckbox.checked,
    timing: parseInt(timingSelect.value),
    silent: silentCheckbox.checked
  };

  const result = await window.electronAPI.setAutoRefreshSettings(settings);

  const statusDiv = document.getElementById('autoRefreshStatus')!;
  if (result.success) {
    statusDiv.innerHTML = '<div class="status success">자동 갱신 설정이 저장되었습니다</div>';
  } else {
    statusDiv.innerHTML = '<div class="status error">설정 저장 실패</div>';
  }

  setTimeout(() => {
    statusDiv.innerHTML = '';
  }, 3000);
};

// ========== 백업 설정 기능 ==========
interface BackupSettings {
  type: 'none' | 'local';
  localPath: string;
  autoBackup: boolean;
}

async function loadBackupSettings() {
  // 백업 경로 가져오기
  const backupPath = await window.electronAPI.getBackupPath();

  const saved = localStorage.getItem('backupSettings');
  const settings: BackupSettings = saved ? JSON.parse(saved) : {
    type: 'none',
    localPath: backupPath,
    autoBackup: false
  };

  // 경로가 없으면 새로 가져온 경로로 설정
  if (!settings.localPath) {
    settings.localPath = backupPath;
  }

  const backupType = document.getElementById('backupType') as HTMLSelectElement;
  const autoBackup = document.getElementById('autoBackup') as HTMLInputElement;
  const localPath = document.getElementById('localPath') as HTMLInputElement;

  if (backupType) {
    backupType.value = settings.type;
    // 타입에 맞는 설정 영역 표시
    document.getElementById('localBackupSettings')!.style.display = settings.type === 'local' ? 'block' : 'none';
  }

  if (autoBackup) {
    autoBackup.checked = settings.autoBackup;
  }

  if (localPath) {
    localPath.value = settings.localPath;
  }
}

(window as any).saveBackupSettings = async function() {
  const backupType = (document.getElementById('backupType') as HTMLSelectElement).value;
  const autoBackup = (document.getElementById('autoBackup') as HTMLInputElement).checked;
  const localPath = (document.getElementById('localPath') as HTMLInputElement).value;

  const settings: BackupSettings = {
    type: backupType as any,
    localPath: localPath,
    autoBackup: autoBackup
  };

  localStorage.setItem('backupSettings', JSON.stringify(settings));

  // ~/.key-ti/backup-settings.json에도 저장 (자동 백업을 위해)
  if (backupType === 'local') {
    const backupPath = await window.electronAPI.getBackupPath();
    await window.electronAPI.saveBackup({
      _settingsOnly: true,
      settings: settings
    });
  }

  showStatus('백업 설정이 저장되었습니다', 'success');
};

(window as any).backupNow = async function() {
  const saved = localStorage.getItem('backupSettings');
  const settings: BackupSettings = saved ? JSON.parse(saved) : { type: 'none', localPath: '', autoBackup: false };

  if (settings.type === 'none') {
    showStatus('백업 위치를 먼저 선택하고 설정을 저장하세요', 'error');
    return;
  }

  showStatus('백업 중...', 'info');

  // 백업할 데이터 수집
  const profilesData = await window.electronAPI.getProfiles();
  const otpAccountsData = await window.electronAPI.getOTPAccounts();
  const memosData = localStorage.getItem('memos');
  const linksData = localStorage.getItem('links');
  const settingsData = localStorage.getItem('backupSettings');

  const backupData = {
    profiles: profilesData,
    otpAccounts: otpAccountsData,
    memos: memosData ? JSON.parse(memosData) : [],
    links: linksData ? JSON.parse(linksData) : [],
    backupSettings: settingsData ? JSON.parse(settingsData) : null,
    timestamp: new Date().toISOString()
  };

  const result = await window.electronAPI.saveBackup(backupData);

  if (result.success) {
    showStatus(`백업 완료: ${result.filename}`, 'success');
  } else {
    showStatus('백업 실패: ' + result.message, 'error');
  }
};

(window as any).restoreBackup = async function() {
  const modal = document.getElementById('restoreBackupModal');
  const container = document.getElementById('backupListContainer');

  if (!modal || !container) return;

  modal.classList.add('active');
  container.innerHTML = '<p>로딩 중...</p>';

  const result = await window.electronAPI.listBackups();

  if (!result.success || result.backups.length === 0) {
    container.innerHTML = '<p style="color: #999;">저장된 백업이 없습니다</p>';
    return;
  }

  const backupPath = await window.electronAPI.getBackupPath();
  const totalBackups = result.backups.length;
  const displayBackups = result.backups.slice(0, 5); // 최신 5개만
  const remainingCount = totalBackups - 5;

  // 백업 파일 목록 표시 (최신 5개)
  let html = displayBackups.map((backup: any) => {
    const date = new Date(backup.timestamp);
    const dateStr = date.toLocaleString('ko-KR');
    const sizeKB = (backup.size / 1024).toFixed(1);

    return `
      <div class="profile-item" style="cursor: pointer; margin-bottom: 12px;" onclick="selectBackupToRestore('${backup.filename}')">
        <div class="profile-info">
          <div class="profile-alias">${backup.filename}</div>
          <div class="profile-details">
            날짜: ${dateStr} | 크기: ${sizeKB} KB
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 추가 백업이 있으면 안내 메시지 표시
  if (remainingCount > 0) {
    html += `
      <div style="padding: 12px; background: #f5f5f5; border-radius: 6px; margin-top: 12px;">
        <p style="margin: 0; font-size: 13px; color: #666;">
          ℹ️ ${remainingCount}개의 백업이 더 있습니다
        </p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
          ${backupPath}
        </p>
      </div>
    `;
  }

  container.innerHTML = html;
};

(window as any).closeRestoreModal = function() {
  const modal = document.getElementById('restoreBackupModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

(window as any).selectBackupToRestore = async function(filename: string) {
  // 활성 세션 확인
  const currentProfiles = await window.electronAPI.getProfiles();
  const activeProfiles = currentProfiles.filter(p => p.isActive);

  let confirmMessage = '백업을 복원하면 현재 데이터가 모두 대체됩니다.';

  if (activeProfiles.length > 0) {
    const activeNames = activeProfiles.map(p => p.alias).join(', ');
    confirmMessage += `\n\n현재 로그인된 세션 (${activeProfiles.length}개)이 있습니다:\n${activeNames}\n\n모든 세션을 로그아웃하고 복원을 진행합니다.`;
  }

  confirmMessage += '\n\n계속하시겠습니까?';

  if (!confirm(confirmMessage)) {
    return;
  }

  (window as any).closeRestoreModal();

  // 활성 세션이 있으면 먼저 로그아웃
  if (activeProfiles.length > 0) {
    showStatus(`${activeProfiles.length}개 세션 로그아웃 중...`, 'info');

    for (const profile of activeProfiles) {
      try {
        await window.electronAPI.deactivateProfile(profile.alias);
      } catch (err) {
        console.error('Logout error during restore:', err);
      }
    }
  }

  showStatus('백업 복원 중...', 'info');

  const loadResult = await window.electronAPI.loadBackup(filename);

  if (!loadResult.success) {
    showStatus('백업 로드 실패: ' + loadResult.message, 'error');
    return;
  }

  await restoreFromBackupData(loadResult.data);
};

async function restoreFromBackupData(backupData: any) {
  // 1. 기존 프로필 모두 삭제
  const existingProfiles = await window.electronAPI.getProfiles();

  for (const profile of existingProfiles) {
    try {
      await window.electronAPI.deleteProfile(profile.alias);
    } catch (err) {
      console.error('Delete profile error during restore:', err);
    }
  }

  // 2. 백업된 프로필 복원
  if (backupData.profiles && Array.isArray(backupData.profiles)) {
    for (const profile of backupData.profiles) {
      try {
        // isActive 제거하고 추가 (세션은 복원하지 않음)
        const cleanProfile = { ...profile };
        delete cleanProfile.isActive;
        delete cleanProfile.lastRefresh;
        delete cleanProfile.expiration;
        await window.electronAPI.addProfile(cleanProfile);
      } catch (err) {
        console.error('Profile restore error:', err);
      }
    }
  }

  // 3. OTP 계정 복원
  if (backupData.otpAccounts && Array.isArray(backupData.otpAccounts)) {
    // 기존 OTP 계정 모두 삭제
    const existingOTPAccounts = await window.electronAPI.getOTPAccounts();
    for (const account of existingOTPAccounts) {
      try {
        await window.electronAPI.deleteOTPAccount(account.id);
      } catch (err) {
        console.error('Delete OTP account error during restore:', err);
      }
    }

    // 백업된 OTP 계정 복원
    for (const account of backupData.otpAccounts) {
      try {
        await window.electronAPI.addOTPAccount(account);
      } catch (err) {
        console.error('OTP account restore error:', err);
      }
    }
  }

  // 4. 메모 복원
  if (backupData.memos) {
    localStorage.setItem('memos', JSON.stringify(backupData.memos));
    memos = backupData.memos;
    renderMemoFiles();
  }

  // 5. 링크 복원
  if (backupData.links) {
    localStorage.setItem('links', JSON.stringify(backupData.links));
    links = backupData.links;
    renderLinks();
  }

  // 6. 백업 설정 복원
  if (backupData.backupSettings) {
    localStorage.setItem('backupSettings', JSON.stringify(backupData.backupSettings));
    await loadBackupSettings();
  }

  // 7. 프로필 리로드
  await loadProfiles();

  showStatus(`백업이 복원되었습니다 (${backupData.timestamp || '시간 정보 없음'})`, 'success');
}

// ========== OTP 관리 ==========
let otpAccounts: OTPAccount[] = [];
let otpUpdateInterval: any = null;
let activeOTPId: string | null = null;

async function loadOTPAccounts() {
  otpAccounts = await window.electronAPI.getOTPAccounts();
  await renderOTPAccounts();

  // 자동 갱신 중지
  if (otpUpdateInterval) {
    clearInterval(otpUpdateInterval);
    otpUpdateInterval = null;
  }
}

async function renderOTPAccounts() {
  const accountsList = document.getElementById('otpAccountsList');
  if (!accountsList) return;

  if (otpAccounts.length === 0) {
    accountsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔐</div>
        <p>등록된 OTP 계정이 없습니다</p>
      </div>
    `;
    return;
  }

  const accountsHTML = await Promise.all(otpAccounts.map(async (account) => {
    const isActive = activeOTPId === account.id;
    let codeDisplay = '';

    if (isActive) {
      const result = await window.electronAPI.generateOTPCode(account);
      if (result.success) {
        const timeRemaining = result.timeRemaining || 0;
        codeDisplay = `
          <div style="display: flex; align-items: center; gap: 12px; margin-right: 12px;">
            <div class="otp-code" onclick="copyOTPCode('${result.token}')" title="클릭하여 복사" style="font-size: 24px; font-weight: 600; cursor: pointer; font-family: monospace;">
              ${result.token}
            </div>
            <div style="font-size: 18px; color: #666; font-weight: 500;">${timeRemaining}s</div>
          </div>
        `;
      }
    }

    return `
      <div class="otp-account-item ${isActive ? 'active' : ''}" onclick="toggleOTPGeneration('${account.id}')" style="cursor: pointer;">
        <div class="otp-account-info">
          <div class="otp-account-name">${account.name}</div>
          ${account.issuer ? `<div class="otp-account-issuer">${account.issuer}</div>` : ''}
        </div>
        <div class="otp-code-section">
          ${codeDisplay || '<div style="color: #999; font-size: 14px; margin-right: 12px;">클릭하여 코드 생성</div>'}
          <div class="otp-actions" onclick="event.stopPropagation()">
            <button class="btn-secondary" onclick="viewOTPDetails('${account.id}')" title="설정 보기">ⓘ</button>
            <button class="btn-danger" onclick="deleteOTPAccount('${account.id}')">삭제</button>
          </div>
        </div>
      </div>
    `;
  }));

  accountsList.innerHTML = accountsHTML.join('');
}

async function toggleOTPGeneration(id: string) {
  // 같은 걸 다시 클릭하면 중지
  if (activeOTPId === id) {
    activeOTPId = null;
    if (otpUpdateInterval) {
      clearInterval(otpUpdateInterval);
      otpUpdateInterval = null;
    }
    await renderOTPAccounts();
    return;
  }

  // 다른 걸 클릭하면 기존 것 중지하고 새로 시작
  activeOTPId = id;

  if (otpUpdateInterval) {
    clearInterval(otpUpdateInterval);
  }

  // 즉시 코드 생성 및 복사
  const account = otpAccounts.find(a => a.id === id);
  if (account) {
    const result = await window.electronAPI.generateOTPCode(account);
    if (result.success && result.token) {
      await navigator.clipboard.writeText(result.token);
      showStatus(`OTP 코드가 복사되었습니다: ${result.token}`, 'success');
    }
  }

  await renderOTPAccounts();

  // 1초마다 갱신
  otpUpdateInterval = setInterval(async () => {
    await renderOTPAccounts();
  }, 1000);
}

(window as any).toggleOTPGeneration = toggleOTPGeneration;

(window as any).openAddOTPModal = function() {
  const modal = document.getElementById('otpModal');
  const form = document.getElementById('otpForm') as HTMLFormElement;

  if (modal && form) {
    form.reset();
    modal.classList.add('active');
  }
};

(window as any).closeOTPModal = function() {
  const modal = document.getElementById('otpModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

(window as any).copyOTPCode = function(token: string) {
  navigator.clipboard.writeText(token).then(() => {
    showStatus('OTP 코드가 복사되었습니다', 'success');
  }).catch(() => {
    showStatus('복사 실패', 'error');
  });
};

(window as any).viewOTPDetails = function(id: string) {
  const account = otpAccounts.find(a => a.id === id);
  if (!account) return;

  const details = `
=== OTP 계정 정보 ===

이름: ${account.name}
발급자: ${account.issuer || '(없음)'}

Secret Key: ${account.secret}
알고리즘: ${(account.algorithm || 'SHA1').toUpperCase()}
자릿수: ${account.digits || 6}
갱신 주기: ${account.period || 30}초

======================
  `.trim();

  alert(details);
};

(window as any).deleteOTPAccount = async function(id: string) {
  const account = otpAccounts.find(a => a.id === id);
  if (!account) return;

  if (!confirm(`"${account.name}" OTP 계정을 삭제하시겠습니까?`)) {
    return;
  }

  const result = await window.electronAPI.deleteOTPAccount(id);
  if (result.success) {
    showStatus('OTP 계정이 삭제되었습니다', 'success');
    await loadOTPAccounts();
  } else {
    showStatus('OTP 계정 삭제 실패', 'error');
  }
};

// OTP URI 파싱 함수
function parseOTPAuthURI(uri: string): Partial<OTPAccount> | null {
  try {
    // otpauth:// 형식 확인
    if (!uri.startsWith('otpauth://totp/')) {
      return null;
    }

    const url = new URL(uri);
    const secret = url.searchParams.get('secret');

    if (!secret) {
      return null;
    }

    // 라벨에서 이름 추출 (예: "Google:user@example.com" -> name: "user@example.com", issuer: "Google")
    const pathParts = decodeURIComponent(url.pathname.substring(1)).split(':');
    let name = pathParts[pathParts.length - 1];
    let issuer = url.searchParams.get('issuer') || (pathParts.length > 1 ? pathParts[0] : '');

    return {
      name,
      issuer: issuer || undefined,
      secret: secret.toUpperCase(),
      algorithm: (url.searchParams.get('algorithm')?.toLowerCase() || 'sha1') as 'sha1' | 'sha256' | 'sha512',
      digits: parseInt(url.searchParams.get('digits') || '6'),
      period: parseInt(url.searchParams.get('period') || '30')
    };
  } catch (error) {
    console.error('Failed to parse OTP URI:', error);
    return null;
  }
}

// OTP 폼 제출
document.addEventListener('DOMContentLoaded', () => {
  const otpForm = document.getElementById('otpForm');
  if (otpForm) {
    // Secret 필드에 자동 포맷팅 및 URI 파싱 추가
    const secretInput = document.getElementById('otpSecret') as HTMLInputElement;
    if (secretInput) {
      secretInput.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const value = input.value.trim();

        // otpauth:// URI가 입력된 경우
        if (value.startsWith('otpauth://totp/')) {
          const parsed = parseOTPAuthURI(value);
          if (parsed) {
            // 모든 필드 자동 채우기
            (document.getElementById('otpName') as HTMLInputElement).value = parsed.name || '';
            (document.getElementById('otpIssuer') as HTMLInputElement).value = parsed.issuer || '';
            (document.getElementById('otpSecret') as HTMLInputElement).value = parsed.secret || '';
            (document.getElementById('otpAlgorithm') as HTMLSelectElement).value = parsed.algorithm || 'sha1';
            (document.getElementById('otpDigits') as HTMLSelectElement).value = String(parsed.digits || 6);
            (document.getElementById('otpPeriod') as HTMLSelectElement).value = String(parsed.period || 30);

            showStatus('OTP URI가 파싱되었습니다', 'success');
          }
        }
      });

      // 붙여넣기 시 공백 자동 제거 및 대문자 변환 (일반 secret key인 경우만)
      secretInput.addEventListener('paste', (e) => {
        setTimeout(() => {
          const value = secretInput.value.trim();
          // otpauth URI가 아닌 경우만 포맷팅
          if (!value.startsWith('otpauth://')) {
            secretInput.value = value.replace(/\s/g, '').toUpperCase();
          }
        }, 10);
      });
    }

    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = (document.getElementById('otpName') as HTMLInputElement).value;
      const issuer = (document.getElementById('otpIssuer') as HTMLInputElement).value;
      const secret = (document.getElementById('otpSecret') as HTMLInputElement).value.replace(/\s/g, '').toUpperCase();
      const algorithm = (document.getElementById('otpAlgorithm') as HTMLSelectElement).value as 'sha1' | 'sha256' | 'sha512';
      const digits = parseInt((document.getElementById('otpDigits') as HTMLSelectElement).value);
      const period = parseInt((document.getElementById('otpPeriod') as HTMLSelectElement).value);

      const account: OTPAccount = {
        id: Date.now().toString(),
        name,
        issuer: issuer || undefined,
        secret,
        algorithm,
        digits,
        period
      };

      const result = await window.electronAPI.addOTPAccount(account);
      if (result.success) {
        showStatus('OTP 계정이 추가되었습니다', 'success');
        (window as any).closeOTPModal();
        await loadOTPAccounts();
      } else {
        showStatus('OTP 계정 추가 실패', 'error');
      }
    });
  }
});

// Make this file a module to allow global declarations
export {};
