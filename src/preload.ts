import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
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
  getAutoBackupSettings: () => ipcRenderer.invoke('get-auto-backup-settings')
});
