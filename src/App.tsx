import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import CardSearch from './components/card/CardSearch';
import { AppTab } from './types';
import { fetchSymbols } from './utils/symbolHelper';
import useToast from './hooks/useToast';
import { useShortcuts } from './hooks/useShortcuts';
import RootLayout from './components/layout/RootLayout';
import { useDeckStore } from './store/useDeckStore';
import { dispatchPendingAction } from './hooks/usePendingAction';
import { extractShareParam, SHARE_PARAM } from './services/deckShare';
import { useDeckActions } from './hooks/useDeckActions';
import { useGlobalRipple } from './hooks/useGlobalRipple';
import { useVisualEffects } from './hooks/useVisualEffects';
import useOnlineStatus from './hooks/useOnlineStatus';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { APP_EVENTS, emitAppEvent, onAppEvent } from './constants/appEvents';

// 'search' is the landing tab and stays in the entry chunk so first paint costs no
// extra round trip. The other two are split out and then warmed on idle below, so
// switching tabs still feels instant without their cost landing on startup.
const DeckManager = lazy(() => import('./components/deck/DeckManager'));
const CollectionManager = lazy(() => import('./components/collection/CollectionManager'));

/** Pull the deferred tab chunks into cache once the app is done booting. */
const prefetchTabs = () => {
  void import('./components/deck/DeckManager');
  void import('./components/collection/CollectionManager');
};

function App() {
  const { t, i18n } = useTranslation();
  const { motionEnabled } = useVisualEffects();
  useGlobalRipple();
  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const { toastMessage, toastVariant, toastAction, showToast } = useToast();
  const isOnline = useOnlineStatus();

  const editingDeck = useDeckStore((state) => state.editingDeck);
  const setPendingSharedDeck = useDeckStore((state) => state.setPendingSharedDeck);

  const { handleAddToDeck, handleAddTokenToDeck } = useDeckActions(showToast);

  const handleSearchFocus = useCallback(() => {
    setActiveTab('search');
    dispatchPendingAction('focus-search');
  }, []);

  const handleSaveDeck = useCallback(() => {
    setActiveTab('deck');
    dispatchPendingAction('save-deck');
  }, []);

  const handlePlaytest = useCallback(() => {
    setActiveTab('deck');
    dispatchPendingAction('playtest-deck');
  }, []);

  const handleClearDeck = useCallback(() => {
    setActiveTab('deck');
    dispatchPendingAction('clear-deck');
  }, []);

  const handleEscape = useCallback(() => {
    emitAppEvent(APP_EVENTS.escape);
  }, []);

  useShortcuts({
    onSearchFocus: handleSearchFocus,
    onEscape: handleEscape,
    onSaveDeck: handleSaveDeck,
    onPlaytest: handlePlaytest,
    onClearDeck: handleClearDeck
  });

  // On startup, a `?deck=` share link hands its payload to the deck manager and
  // is stripped from the address bar so a refresh doesn't re-import it.
  useEffect(() => {
    const encoded = extractShareParam(window.location.search);
    if (!encoded) return;
    setPendingSharedDeck(encoded);
    setActiveTab('deck');
    const url = new URL(window.location.href);
    url.searchParams.delete(SHARE_PARAM);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [setPendingSharedDeck]);

  useEffect(() => {
    fetchSymbols();

    return onAppEvent(APP_EVENTS.toast, ({ message, variant }) => showToast(message, variant));
  }, [showToast]);

  // Detached views (e.g. the collection's empty state) can request a tab
  // switch without receiving the setter through props.
  useEffect(() => {
    return onAppEvent(APP_EVENTS.navigateTab, (tab) => {
      if (tab === 'search' || tab === 'deck' || tab === 'collection') {
        setActiveTab(tab);
        if (tab === 'search') dispatchPendingAction('focus-search');
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = i18n.language || 'en';
  }, [i18n.language]);

  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (idle) {
      const handle = idle(prefetchTabs);
      return () => window.cancelIdleCallback?.(handle);
    }
    // Safari (< 17) has no requestIdleCallback; a short timeout is close enough.
    const timer = window.setTimeout(prefetchTabs, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      showToast(t('common.backOnline'), 'success');
    }
  }, [isOnline, showToast, t]);

  useEffect(() => {
    const safeWindow = window as unknown as {
      electronAPI?: {
        on: (channel: string, listener: () => void) => () => void;
      };
    };

    const ipc = safeWindow.electronAPI;
    if (ipc) {
      const unsubscribe = ipc.on('menu-clear-deck', handleClearDeck);
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [handleClearDeck]);

  return (
    <RootLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      toastMessage={toastMessage}
      toastVariant={toastVariant}
      toastAction={toastAction}
      isOnline={isOnline}
    >
      {/* h-full keeps the h-full/flex chain from .page-container intact so each
          view's own body (workspace-body / results area) is the scroll container;
          without it this wrapper grows to content height and .main-content
          (overflow-hidden) clips everything below the fold. */}
      <div key={activeTab} className={motionEnabled ? 'view-fade h-full' : 'h-full'}>
        {activeTab === 'search' ? (
          <CardSearch
            onAddToDeck={handleAddToDeck}
            onAddTokenToDeck={handleAddTokenToDeck}
            activeFormat={editingDeck.deckFormat}
          />
        ) : (
          // Scoped so a failed IndexedDB read inside one tab degrades that tab instead of
          // the whole app: Dexie's useLiveQuery throws during render, and the only other
          // boundary is the root one in main.tsx.
          <ErrorBoundary variant="section">
            <Suspense
              fallback={
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('common.loading')}...</div>
              }
            >
              {activeTab === 'collection' ? <CollectionManager /> : <DeckManager showToast={showToast} />}
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </RootLayout>
  );
}

export default App;
