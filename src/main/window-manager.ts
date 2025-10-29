// 윈도우 생성 및 관리
import { BrowserWindow, nativeImage, app } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getIconPath } from '../shared/utils.js';
import { OTPAccount } from '../shared/types.js';

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private otpWindow: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    const iconPath = getIconPath();

    this.mainWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true
      },
      backgroundColor: '#f5f5f7',
      title: 'Key-ti',
      icon: iconPath
    });

    this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    return this.mainWindow;
  }

  createOTPWindow(account: OTPAccount): BrowserWindow {
    if (this.otpWindow && !this.otpWindow.isDestroyed()) {
      this.otpWindow.close();
    }

    let x = 100;
    let y = 100;

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const mainBounds = this.mainWindow.getBounds();
      x = mainBounds.x + mainBounds.width + 20;
      y = mainBounds.y;
    }

    this.otpWindow = new BrowserWindow({
      width: 300,
      height: 380,
      x: x,
      y: y,
      frame: false,
      resizable: false,
      transparent: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      backgroundColor: '#667eea'
    });

    const htmlContent = this.generateOTPWindowHTML(account);
    this.otpWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    this.otpWindow.on('closed', () => {
      this.otpWindow = null;
    });

    return this.otpWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  getOTPWindow(): BrowserWindow | null {
    return this.otpWindow;
  }

  closeOTPWindow(): void {
    if (this.otpWindow && !this.otpWindow.isDestroyed()) {
      this.otpWindow.close();
      this.otpWindow = null;
    }
  }

  destroyAll(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
      this.mainWindow = null;
    }
    if (this.otpWindow && !this.otpWindow.isDestroyed()) {
      this.otpWindow.destroy();
      this.otpWindow = null;
    }
  }

  private generateOTPWindowHTML(account: OTPAccount): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 30px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          box-sizing: border-box;
        }
        .close-btn {
          position: absolute;
          top: 15px;
          right: 15px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: rotate(90deg);
        }
        .title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          opacity: 0.9;
          text-align: center;
        }
        .issuer {
          font-size: 12px;
          opacity: 0.7;
          margin-bottom: 30px;
          text-align: center;
        }
        .code {
          font-size: 52px;
          font-weight: 700;
          letter-spacing: 8px;
          margin: 30px 0;
          font-family: Monaco, monospace;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          user-select: none;
          transition: transform 0.2s;
        }
        .code:hover {
          transform: scale(1.05);
          opacity: 0.9;
        }
        .code:active {
          transform: scale(0.98);
        }
        .timer {
          font-size: 28px;
          font-weight: 600;
          margin-top: 15px;
          opacity: 0.9;
        }
        .hint {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 30px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <button class="close-btn" onclick="window.close()">×</button>
      <div class="title">${account.name}</div>
      <div class="issuer">${account.issuer || ''}</div>
      <div class="code" id="code">------</div>
      <div class="timer" id="timer">30s</div>
      <div class="hint">클릭하여 복사</div>

      <script>
        const { ipcRenderer } = require('electron');
        const account = ${JSON.stringify(account)};

        async function updateOTP() {
          const result = await ipcRenderer.invoke('generate-otp-code', account);
          if (result.success) {
            document.getElementById('code').textContent = result.token || '------';
            document.getElementById('timer').textContent = result.timeRemaining + 's';
          }
        }

        function copyCode() {
          const code = document.getElementById('code').textContent;
          if (code && code !== '------') {
            try {
              const textarea = document.createElement('textarea');
              textarea.value = code;
              textarea.style.position = 'fixed';
              textarea.style.opacity = '0';
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);

              const codeEl = document.getElementById('code');
              if (codeEl) {
                codeEl.style.opacity = '0.5';
                setTimeout(() => {
                  codeEl.style.opacity = '1';
                }, 200);
              }
              console.log('Copied:', code);
            } catch (err) {
              console.error('Failed to copy:', err);
            }
          }
        }

        document.getElementById('code').addEventListener('click', copyCode);
        updateOTP();
        setInterval(updateOTP, 1000);
      </script>
    </body>
    </html>
  `;
  }
}
