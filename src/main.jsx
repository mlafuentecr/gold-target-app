import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position='top-center'
      richColors
      expand={false}
      toastOptions={{
        style: {
          background: '#1a1b22',
          color: '#f5c77a',
          border: '1px solid rgba(245,199,122,0.2)',
          fontFamily: 'inherit',
        },
      }}
    />
  </React.StrictMode>
);
