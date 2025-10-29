import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import MainApp from './components/MainApp.js';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>
);
