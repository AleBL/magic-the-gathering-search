import { ReactNode, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaLayerGroup, FaBoxOpen } from 'react-icons/fa';
import { AppTab } from '../../types';
import Header from './Header';
import AmbientGlow from '../ui/AmbientGlow';
import OfflineIndicator from '../ui/OfflineIndicator';
import Toast from '../ui/Toast';
import CustomDialog from '../ui/CustomDialog';
import CommandPalette from '../ui/CommandPalette';
import AppShortcutsOverlay from '../ui/AppShortcutsOverlay';
import useDarkMode from '../../hooks/useDarkMode';
import { useDeckStore } from '../../store/useDeckStore';
import useDialog from '../../hooks/useDialog';
import { ToastAction, ToastVariant } from '../../types/Toast';

interface RootLayoutProps {
  children: ReactNode;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  toastMessage: string | null;
  toastVariant: ToastVariant;
  toastAction: ToastAction | undefined;
  isOnline: boolean;
}

export default function RootLayout({
  children,
  activeTab,
  setActiveTab,
  toastMessage,
  toastVariant,
  toastAction,
  isOnline
}: RootLayoutProps) {
  const { t } = useTranslation();
  const [isDarkMode, setIsDarkMode] = useDarkMode();
  const { dialogState, closeDialog } = useDialog();

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // The playtest is a fullscreen mode with its own shortcuts; don't fire app-level ones underneath it.
      if (document.body.dataset.playtestOpen === 'true') return;
      const target = e.target as HTMLElement;
      const inField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      } else if (e.key === '?' && !inField) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentDeckLength = useDeckStore((state) => state.currentDeck.length);
  const editingDeck = useDeckStore((state) => state.editingDeck);
  const cancelEdit = useDeckStore((state) => state.cancelEdit);

  return (
    <div className="page-container">
      <AmbientGlow />
      {!isOnline && <OfflineIndicator />}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentDeckLength={currentDeckLength}
        editingDeck={editingDeck}
        onCancelEdit={cancelEdit}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      <main className="main-content">{children}</main>

      <nav className="bottom-tab-bar" aria-label={t('common.mainNavigation')}>
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`bottom-tab-button ${activeTab === 'search' ? 'bottom-tab-button-active' : ''}`}
          aria-label={t('common.searchTab')}
          aria-current={activeTab === 'search' ? 'page' : undefined}
        >
          <FaSearch className="bottom-tab-button-icon" />
          <span>{t('common.searchTab')}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('deck')}
          className={`bottom-tab-button ${activeTab === 'deck' ? 'bottom-tab-button-active' : ''}`}
          aria-label={t('common.decksTab')}
          aria-current={activeTab === 'deck' ? 'page' : undefined}
        >
          <FaLayerGroup className="bottom-tab-button-icon" />
          <span>{t('common.decksTab')}</span>
          {currentDeckLength > 0 && (
            <span className="count-badge absolute top-1 right-[calc(50%-22px)]">{currentDeckLength}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('collection')}
          className={`bottom-tab-button ${activeTab === 'collection' ? 'bottom-tab-button-active' : ''}`}
          aria-label={t('collection.title')}
          aria-current={activeTab === 'collection' ? 'page' : undefined}
        >
          <FaBoxOpen className="bottom-tab-button-icon" />
          <span>{t('collection.tab')}</span>
        </button>
      </nav>

      {toastMessage && <Toast message={toastMessage} variant={toastVariant} action={toastAction} />}
      <CustomDialog
        isOpen={dialogState.isOpen}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={dialogState.onConfirm}
        onCancel={closeDialog}
        variant={dialogState.variant}
      />

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onShowShortcuts={() => setIsShortcutsOpen(true)}
      />
      <AppShortcutsOverlay isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
}
