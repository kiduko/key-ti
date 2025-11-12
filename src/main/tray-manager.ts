// Tray 아이콘 및 메뉴 관리
import { Tray, Menu, nativeImage, app } from 'electron';
import { getIconPath } from '../shared/utils.js';
import { AWSProfile } from '../shared/types.js';

interface ClaudeSessionInfo {
  cost: number;
  timeUntilReset: string;
}

export class TrayManager {
  private tray: Tray | null = null;
  private onShowWindow: () => void;
  private onQuit: () => void;
  private claudeSessionInfo: ClaudeSessionInfo | null = null;

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

  updateClaudeSession(cost: number, timeUntilReset: string): void {
    this.claudeSessionInfo = { cost, timeUntilReset };
    this.updateTrayDisplay();
  }

  update(activeProfiles: string[], profiles: AWSProfile[]): void {
    if (!this.tray) return;

    // Dock 아이콘 업데이트 (AWS 세션 수)
    this.updateDockIcon(activeProfiles);

    this.updateTrayDisplay();

    const menuItems: any[] = [];

    // Claude Code 세션 정보 표시
    if (this.claudeSessionInfo) {
      menuItems.push({
        label: `Claude Code 세션`,
        enabled: false
      });
      menuItems.push({
        label: `  비용: $${this.claudeSessionInfo.cost.toFixed(2)}`,
        enabled: false
      });
      menuItems.push({
        label: `  리셋: ${this.claudeSessionInfo.timeUntilReset}`,
        enabled: false
      });
      menuItems.push({ type: 'separator' });
    }

    // AWS 활성 세션 표시
    if (activeProfiles.length > 0) {
      menuItems.push({
        label: `AWS 활성 세션 (${activeProfiles.length}개)`,
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

  private updateTrayDisplay(): void {
    if (!this.tray) return;

    // Claude Code 세션 정보를 타이틀에 표시
    if (this.claudeSessionInfo) {
      // "3시간 14분 후" -> "3h14m"로 축약
      const timeText = this.claudeSessionInfo.timeUntilReset
        .replace('시간', 'h')
        .replace('분 후', 'm')
        .replace(' ', '');
      const titleText = `$${this.claudeSessionInfo.cost.toFixed(2)} | ${timeText}`;
      this.tray.setTitle(titleText);
      this.tray.setToolTip(`Claude Code 세션\n비용: $${this.claudeSessionInfo.cost.toFixed(2)}\n리셋: ${this.claudeSessionInfo.timeUntilReset}`);
    } else {
      this.tray.setTitle('');
      this.tray.setToolTip('Key-ti');
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
