// Tray 아이콘 및 메뉴 관리
import { Tray, Menu, nativeImage, app } from 'electron';
import { getIconPath } from '../shared/utils.js';
import { AWSProfile } from '../shared/types.js';

export class TrayManager {
  private tray: Tray | null = null;
  private onShowWindow: () => void;
  private onQuit: () => void;

  constructor(onShowWindow: () => void, onQuit: () => void) {
    this.onShowWindow = onShowWindow;
    this.onQuit = onQuit;
  }

  create(): Tray {
    const iconPath = getIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    const resizedIcon = icon.resize({ width: 16, height: 16 });
    resizedIcon.setTemplateImage(true);

    this.tray = new Tray(resizedIcon);
    this.update([], []);

    this.tray.on('click', () => {
      this.onShowWindow();
    });

    return this.tray;
  }

  update(activeProfiles: string[], profiles: AWSProfile[]): void {
    if (!this.tray) return;

    // Dock 아이콘 업데이트
    this.updateDockIcon(activeProfiles);

    const titleText = `${activeProfiles.length}`;
    this.tray.setTitle(titleText);
    this.tray.setToolTip(`Key-ti - ${activeProfiles.length}개 활성 세션`);

    const menuItems: any[] = [];

    if (activeProfiles.length > 0) {
      menuItems.push({
        label: `활성 세션 (${activeProfiles.length}개)`,
        enabled: false
      });

      activeProfiles.forEach(alias => {
        const profile = profiles.find(p => p.alias === alias);
        if (profile) {
          let expirationText = '';
          if (profile.expiration) {
            const expiration = new Date(profile.expiration);
            const now = new Date();
            const remainingMinutes = Math.floor((expiration.getTime() - now.getTime()) / 60000);
            expirationText = remainingMinutes > 0 ? ` (${remainingMinutes}분 남음)` : ' (만료됨)';
          }
          menuItems.push({
            label: `  ${profile.alias} - ${profile.profileName}${expirationText}`,
            enabled: false
          });
        }
      });

      menuItems.push({ type: 'separator' });
    }

    menuItems.push({
      label: 'Key-ti 열기',
      click: this.onShowWindow
    });

    menuItems.push({ type: 'separator' });

    menuItems.push({
      label: '종료',
      click: this.onQuit
    });

    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  private updateDockIcon(activeProfiles: string[]): void {
    if (process.platform !== 'darwin' || !app.dock) {
      return;
    }

    const hasActiveSessions = activeProfiles.length > 0;
    const iconPath = getIconPath();
    const dockIcon = nativeImage.createFromPath(iconPath);

    // Dock 아이콘 크기를 더 크게 조정 (128x128 또는 256x256)
    const resizedDockIcon = dockIcon.resize({ width: 256, height: 256 });

    if (hasActiveSessions) {
      app.dock.setBadge(activeProfiles.length.toString());
    } else {
      app.dock.setBadge('');
    }

    app.dock.setIcon(resizedDockIcon);
  }
}
