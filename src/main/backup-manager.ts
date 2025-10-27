// 백업 관리
import * as fs from 'fs';
import * as path from 'path';
import { getBackupDir } from '../shared/utils';

export class BackupManager {
  getBackupPath(): string {
    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    return backupDir;
  }

  testBackupPath(): { success: boolean; message?: string } {
    try {
      const backupDir = this.getBackupPath();
      const testFile = path.join(backupDir, '.test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  saveBackup(data: any): { success: boolean; filename?: string; message?: string } {
    try {
      const backupDir = this.getBackupPath();

      // 설정만 저장하는 경우
      if (data._settingsOnly) {
        const settingsPath = path.join(backupDir, 'backup-settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(data.settings, null, 2), 'utf8');
        return { success: true, filename: 'backup-settings.json' };
      }

      // 일반 백업
      const timestamp = Date.now();
      const filename = `backup-${timestamp}.json`;
      const filepath = path.join(backupDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');

      return { success: true, filename };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  listBackups(): { success: boolean; backups: any[] } {
    try {
      const backupDir = this.getBackupPath();

      if (!fs.existsSync(backupDir)) {
        return { success: true, backups: [] };
      }

      const files = fs.readdirSync(backupDir);
      const backups = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .map(filename => {
          const filepath = path.join(backupDir, filename);
          const stats = fs.statSync(filepath);
          return {
            filename,
            timestamp: stats.mtime.toISOString(),
            size: stats.size
          };
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return { success: true, backups };
    } catch (error: any) {
      return { success: false, backups: [] };
    }
  }

  loadBackup(filename: string): { success: boolean; data?: any; message?: string } {
    try {
      const backupDir = this.getBackupPath();
      const filepath = path.join(backupDir, filename);

      if (!fs.existsSync(filepath)) {
        return { success: false, message: '백업 파일을 찾을 수 없습니다' };
      }

      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      return { success: true, data };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  getAutoBackupSettings(): { enabled: boolean; type: string } {
    try {
      const backupDir = this.getBackupPath();
      const settingsPath = path.join(backupDir, 'backup-settings.json');

      if (!fs.existsSync(settingsPath)) {
        return { enabled: false, type: 'none' };
      }

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return { enabled: settings.autoBackup || false, type: settings.type || 'none' };
    } catch (error: any) {
      return { enabled: false, type: 'none' };
    }
  }

  /**
   * 앱 종료 시 자동 백업 실행
   */
  async performAutoBackup(getBackupData: () => Promise<any>): Promise<void> {
    try {
      const backupDir = this.getBackupPath();
      const settingsPath = path.join(backupDir, 'backup-settings.json');

      if (!fs.existsSync(settingsPath)) {
        return;
      }

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

      if (settings.autoBackup && settings.type === 'local') {
        console.log('Auto backup starting...');

        const backupData = await getBackupData();
        const timestamp = Date.now();
        const filename = `backup-auto-${timestamp}.json`;
        const filepath = path.join(backupDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');
        console.log('Auto backup completed:', filename);
      }
    } catch (error) {
      console.error('Auto backup failed:', error);
    }
  }
}
