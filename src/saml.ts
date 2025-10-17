import { BrowserWindow, shell } from 'electron';
import * as http from 'http';
import * as url from 'url';

export class SAMLAuthenticator {
  private authWindow: BrowserWindow | null = null;
  private useSystemBrowser: boolean = false;

  async authenticate(samlUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.authWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'persist:saml'
        }
      });

      console.log('SAML: Opening auth window with URL:', samlUrl);
      this.authWindow.loadURL(samlUrl);

      // AWS SAML endpoint로의 POST 요청 가로채기
      this.authWindow.webContents.session.webRequest.onBeforeRequest(
        { urls: ['https://signin.aws.amazon.com/saml*'] },
        (details, callback) => {
          console.log('SAML: Intercepted request to:', details.url);

          if (details.method === 'POST' && details.uploadData) {
            // POST 데이터에서 SAMLResponse 추출
            const uploadData = details.uploadData[0];
            if (uploadData.bytes) {
              const postData = uploadData.bytes.toString();
              console.log('SAML: POST data length:', postData.length);

              const match = postData.match(/SAMLResponse=([^&]+)/);
              if (match) {
                const samlResponse = decodeURIComponent(match[1]);
                console.log('SAML: Found SAMLResponse, length:', samlResponse.length);
                this.closeAuthWindow();
                resolve(samlResponse);
                callback({ cancel: true });
                return;
              }
            }
          }
          callback({});
        }
      );

      // URL 변경 모니터링
      this.authWindow.webContents.on('did-navigate', (event, navUrl) => {
        console.log('SAML: Navigated to:', navUrl);

        // AWS 콘솔로 리다이렉트되면 성공한 것이지만 SAMLResponse를 못 가져온 경우
        if (navUrl.includes('console.aws.amazon.com')) {
          console.log('SAML: Redirected to AWS console - authentication successful but could not capture SAML');
          this.closeAuthWindow();
          reject(new Error('Could not capture SAML assertion - please try again'));
        }
      });

      // 페이지 로드 완료 후 SAML form 감지
      this.authWindow.webContents.on('did-finish-load', async () => {
        const currentUrl = this.authWindow?.webContents.getURL() || '';
        console.log('SAML: Page loaded:', currentUrl);

        // AWS SAML 페이지에서 SAMLResponse 추출 시도
        if (currentUrl.includes('signin.aws.amazon.com')) {
          try {
            const samlResponse = await this.authWindow?.webContents.executeJavaScript(`
              (function() {
                const samlInput = document.querySelector('input[name="SAMLResponse"]');
                return samlInput ? samlInput.value : null;
              })();
            `);

            if (samlResponse) {
              console.log('SAML: Extracted SAMLResponse from page, length:', samlResponse.length);
              this.closeAuthWindow();
              resolve(samlResponse);
            }
          } catch (err) {
            console.log('SAML: Could not extract SAMLResponse from page:', err);
          }
        }
      });

      this.authWindow.on('closed', () => {
        console.log('SAML: Auth window closed by user');
        this.authWindow = null;
        reject(new Error('인증 창을 닫았습니다'));
      });

      // 타임아웃 설정 (5분)
      setTimeout(() => {
        if (this.authWindow) {
          console.log('SAML: Authentication timeout');
          this.closeAuthWindow();
          reject(new Error('인증 시간 초과 (5분)'));
        }
      }, 300000);
    });
  }

  private closeAuthWindow(): void {
    if (this.authWindow) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }

  async getSAMLAssertion(samlUrl: string): Promise<string> {
    console.log('SAML: Getting SAML assertion from:', samlUrl);

    // 사용자가 브라우저에서 로그인 완료 후 SAML assertion 반환
    const samlResponse = await this.authenticate(samlUrl);

    console.log('SAML: Got SAMLResponse (base64), length:', samlResponse.length);

    // SAMLResponse는 이미 base64 인코딩되어 있으므로 그대로 반환
    return samlResponse;
  }
}
