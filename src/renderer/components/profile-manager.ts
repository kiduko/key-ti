// 프로필 관리 UI 컴포넌트
import { AWSProfile } from '../../shared/types';
import { calculateTimeRemaining } from '../../shared/utils';
import { showStatus } from '../utils/toast';

let profiles: AWSProfile[] = [];
let editingAlias: string | null = null;
let timerInterval: any = null;
let isLoginInProgress: boolean = false;

export async function loadProfiles() {
  console.log('Renderer: Loading profiles...');

  await window.electronAPI.validateSessions();
  profiles = await window.electronAPI.getProfiles();

  console.log('Renderer: Loaded profiles:', profiles);
  renderProfiles();
}

export function renderProfiles() {
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
    .map(profile => {
      const isActive = profile.isActive || false;
      let expirationText = '';

      if (profile.expiration) {
        const timeInfo = calculateTimeRemaining(profile.expiration);
        expirationText = `<span class="${timeInfo.className}" data-expiration="${profile.expiration}" onclick="window.activateProfile('${profile.alias}')" style="cursor: pointer; text-decoration: underline;">
          ${timeInfo.text}
        </span>`;
      }

      return `
    <div class="profile-item ${isActive ? 'profile-active' : ''}" style="${isActive ? 'background: #e8f4f8; border-left: 4px solid #5a6c7d;' : ''}">
      <div class="profile-info">
        <div class="profile-alias">
          ${profile.alias} ${isActive ? '<span style="color: #5a6c7d;">●</span>' : ''}
          <button class="btn-delete" onclick="window.deleteProfile('${profile.alias}')" title="삭제">🗑️</button>
        </div>
        <div class="profile-details">
          <strong>Profile:</strong> ${profile.profileName} | <strong>Role:</strong> ${profile.roleArn.split('/').pop()}
          ${expirationText ? '<br>남은 시간: ' + expirationText : ''}
        </div>
      </div>
      <div class="profile-actions">
        ${isActive ? `
          <button class="btn-secondary" onclick="window.openConsole('${profile.alias}')">🌐 콘솔</button>
          <button class="btn-secondary" onclick="window.editProfile('${profile.alias}')">✏️ 편집</button>
          <button class="btn-danger" onclick="window.deactivateProfile('${profile.alias}')">
            로그아웃
          </button>
        ` : `
          <button class="btn-success" onclick="window.activateProfile('${profile.alias}')">
            로그인
          </button>
          <button class="btn-secondary" onclick="window.editProfile('${profile.alias}')">✏️ 편집</button>
        `}
      </div>
    </div>
  `;
    })
    .join('');

  startTimer();
}

function startTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

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

function setProfilesListDisabled(disabled: boolean) {
  const profilesList = document.getElementById('profilesList')!;
  const buttons = profilesList.querySelectorAll('button');

  if (disabled) {
    profilesList.style.opacity = '0.5';
    profilesList.style.pointerEvents = 'none';
    buttons.forEach(btn => {
      btn.disabled = true;
    });
  } else {
    profilesList.style.opacity = '1';
    profilesList.style.pointerEvents = 'auto';
    buttons.forEach(btn => {
      btn.disabled = false;
    });
  }
}

async function populateOTPAccountsDropdown() {
  const select = document.getElementById('otpAccountId') as HTMLSelectElement;
  if (!select) return;

  const accounts = await window.electronAPI.getOTPAccounts();

  select.innerHTML = '<option value="">연결 안 함</option>';

  accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    option.textContent = `${account.name}${account.issuer ? ` (${account.issuer})` : ''}`;
    select.appendChild(option);
  });
}

export async function openAddProfileModal() {
  editingAlias = null;
  const modal = document.getElementById('profileModal')!;
  const modalHeader = modal.querySelector('.modal-header')!;
  modalHeader.textContent = '프로필 추가';

  const form = document.getElementById('profileForm') as HTMLFormElement;
  form.reset();

  (document.getElementById('alias') as HTMLInputElement).disabled = false;

  await populateOTPAccountsDropdown();

  modal.classList.add('active');
}

export function closeProfileModal() {
  const modal = document.getElementById('profileModal')!;
  modal.classList.remove('active');
  editingAlias = null;
}

export async function editProfile(alias: string) {
  const profile = profiles.find(p => p.alias === alias);
  if (!profile) return;

  if (profile.isActive) {
    const shouldLogout = confirm(
      `"${alias}" 프로필을 편집하려면 먼저 로그아웃해야 합니다.\n로그아웃하고 편집하시겠습니까?`
    );

    if (!shouldLogout) return;

    showStatus('세션 로그아웃 중...', 'info');
    const result = await window.electronAPI.deactivateProfile(alias);

    if (!result.success) {
      showStatus('로그아웃 실패: ' + result.message, 'error');
      return;
    }

    await loadProfiles();
  }

  editingAlias = alias;
  const modal = document.getElementById('profileModal')!;
  const modalHeader = modal.querySelector('.modal-header')!;
  modalHeader.textContent = '프로필 편집';

  await populateOTPAccountsDropdown();

  (document.getElementById('alias') as HTMLInputElement).value = profile.alias;
  (document.getElementById('alias') as HTMLInputElement).disabled = true;
  (document.getElementById('profileName') as HTMLInputElement).value = profile.profileName;
  (document.getElementById('roleArn') as HTMLInputElement).value = profile.roleArn;
  (document.getElementById('samlUrl') as HTMLInputElement).value = profile.samlUrl;
  (document.getElementById('idp') as HTMLInputElement).value = profile.idp;
  (document.getElementById('otpAccountId') as HTMLSelectElement).value = profile.otpAccountId || '';

  modal.classList.add('active');
}

export async function deleteProfile(alias: string) {
  if (!confirm(`"${alias}" 프로필을 삭제하시겠습니까?`)) {
    return;
  }

  await window.electronAPI.deleteProfile(alias);
  await loadProfiles();
  showStatus('프로필이 삭제되었습니다', 'success');
}

export async function activateProfile(alias: string) {
  if (isLoginInProgress) {
    return;
  }

  const profile = profiles.find(p => p.alias === alias);
  let hasOTPWindow = false;

  if (profile && profile.otpAccountId) {
    const otpAccounts = await window.electronAPI.getOTPAccounts();
    const otpAccount = otpAccounts.find(a => a.id === profile.otpAccountId);

    if (otpAccount) {
      await window.electronAPI.showOTPWindow(otpAccount);
      hasOTPWindow = true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  isLoginInProgress = true;
  setProfilesListDisabled(true);
  showStatus('세션 활성화 중...', 'info');

  try {
    const result = await window.electronAPI.activateProfile(alias);

    if (hasOTPWindow) {
      await window.electronAPI.closeOTPWindow();
    }

    if (result.success) {
      await loadProfiles();
      showStatus(result.message, 'success');
    } else {
      showStatus(result.message, 'error');
    }
  } finally {
    isLoginInProgress = false;
    setProfilesListDisabled(false);
  }
}

export async function deactivateProfile(alias: string) {
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

export async function openConsole(alias: string) {
  showStatus('AWS 콘솔 열기 중...', 'info');

  const result = await window.electronAPI.openConsole(alias);

  if (result.success) {
    showStatus(result.message, 'success');
  } else {
    showStatus(result.message, 'error');
  }
}

export async function submitProfileForm(e: Event) {
  e.preventDefault();

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
    console.log('Updating profile:', profile);
    await window.electronAPI.updateProfile(editingAlias, profile);
    await loadProfiles();
    closeProfileModal();
    showStatus('프로필이 수정되었습니다', 'success');
  } else {
    console.log('Adding profile:', profile);
    await window.electronAPI.addProfile(profile);
    await loadProfiles();
    closeProfileModal();
    showStatus('프로필이 추가되었습니다', 'success');
  }
}
