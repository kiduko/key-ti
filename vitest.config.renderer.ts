import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Renderer Process (React UI) 테스트 설정
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'renderer',
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.renderer.ts'],
    include: ['src/renderer/**/*.{test,spec}.{ts,tsx}'],
    watch: false,
    css: false, // CSS 처리 건너뛰기
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
});
