import { createRoot } from 'react-dom/client';
import './index.css';
import './plugins/i18n';
import { useEffect } from 'react';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';

function AppWithCallbackAfterRender() {
  useEffect(() => {
    window.postMessage({ payload: 'removeLoading' }, '*');
  }, []);
  return <App />;
}

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

root.render(
  <ErrorBoundary>
    <AppWithCallbackAfterRender />
  </ErrorBoundary>
);
