import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getProfiles: () => ipcRenderer.invoke('get-profiles'),
  addProfile: (profile: any) => ipcRenderer.invoke('add-profile', profile),
  updateProfile: (alias: string, profile: any) => ipcRenderer.invoke('update-profile', alias, profile),
  deleteProfile: (alias: string) => ipcRenderer.invoke('delete-profile', alias),
  activateProfile: (alias: string) => ipcRenderer.invoke('activate-profile', alias),
  deactivateProfile: (alias: string) => ipcRenderer.invoke('deactivate-profile', alias),
  getActiveProfile: () => ipcRenderer.invoke('get-active-profile'),
  validateSessions: () => ipcRenderer.invoke('validate-sessions'),
  openConsole: (alias: string) => ipcRenderer.invoke('open-console', alias),
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
  getBackupPath: () => ipcRenderer.invoke('get-backup-path'),
  testBackupPath: () => ipcRenderer.invoke('test-backup-path'),
  saveBackup: (data: any) => ipcRenderer.invoke('save-backup', data),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  loadBackup: (filename: string) => ipcRenderer.invoke('load-backup', filename),
  getAutoBackupSettings: () => ipcRenderer.invoke('get-auto-backup-settings'),
  getAutoRefreshSettings: () => ipcRenderer.invoke('get-auto-refresh-settings'),
  setAutoRefreshSettings: (settings: any) => ipcRenderer.invoke('set-auto-refresh-settings', settings),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update-available', (_, version) => callback(version));
  },
  // OTP API
  getOTPAccounts: () => ipcRenderer.invoke('get-otp-accounts'),
  addOTPAccount: (account: any) => ipcRenderer.invoke('add-otp-account', account),
  updateOTPAccount: (id: string, account: any) => ipcRenderer.invoke('update-otp-account', id, account),
  deleteOTPAccount: (id: string) => ipcRenderer.invoke('delete-otp-account', id),
  generateOTPCode: (account: any) => ipcRenderer.invoke('generate-otp-code', account),
  showOTPWindow: (account: any) => ipcRenderer.invoke('show-otp-window', account),
  closeOTPWindow: () => ipcRenderer.invoke('close-otp-window'),
  // Text Export/Import API
  exportToText: () => ipcRenderer.invoke('export-to-text'),
  importFromText: (text: string) => ipcRenderer.invoke('import-from-text', text),
  // Claude Usage API
  getClaudeUsageStats: () => ipcRenderer.invoke('get-claude-usage-stats'),
  getClaudeSessionBlocks: (date: string) => ipcRenderer.invoke('get-claude-session-blocks', date),
  // External link
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url)
});
