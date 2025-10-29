import { defineConfig } from 'vitest/config';
import path from 'path';

// Main Process (Node.js/Electron) 테스트 설정
export default defineConfig({
  test: {
    name: 'main',
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.main.ts'],
    include: ['src/main/**/*.{test,spec}.ts', 'src/services/**/*.{test,spec}.ts'],
    watch: false,
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
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
});
