import { createRoot } from 'react-dom/client';
import './index.css';
import './plugins/i18n';
import React, { useEffect } from 'react';
import App from './App';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

function AppWithCallbackAfterRender() {
  useEffect(() => {
    postMessage({ payload: 'removeLoading' }, '*');
  });

  return <App />;
}

root.render(<AppWithCallbackAfterRender />);
