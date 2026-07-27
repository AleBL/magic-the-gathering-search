import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaLayerGroup, FaBoxOpen } from 'react-icons/fa';
import pwLogo from '../../assets/pw-logo.svg';
import ProfileMenu from './ProfileMenu';
import MobilePageMenu from './MobilePageMenu';
import EditingDeckBanner from '../deck/EditingDeckBanner';
import { AppTab } from '../../types';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  currentDeckLength: number;
  editingDeck: {
    deckId: string | null;
    deckName: string;
    deckFormat: string;
  };
  onCancelEdit: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentDeckLength,
  editingDeck,
  onCancelEdit,
  isDarkMode,
  setIsDarkMode
}) => {
  const { t } = useTranslation();

  return (
    <header className="header-container">
      <div className="header-toolbar">
        <div className="app-brand">
          <div className="app-brand-logo-wrapper">
            <div className="app-brand-logo-glow"></div>
            <img src={pwLogo} alt="MTG Deck Forge Logo" className="app-brand-logo-image" />
          </div>
          <h1 className="app-brand-title">{t('common.appTitle')}</h1>
        </div>
        <nav className="tab-group">
          <button
            id="nav-search-btn"
            onClick={() => setActiveTab('search')}
            className={`tab-button ${activeTab === 'search' ? 'tab-button-active' : ''}`}
            aria-label={t('common.searchTab')}
          >
            <FaSearch className="tab-button-icon" />
            <span>{t('common.searchTab')}</span>
          </button>
          <button
            onClick={() => setActiveTab('deck')}
            className={`tab-button ${activeTab === 'deck' ? 'tab-button-active' : ''}`}
            aria-label={t('common.decksTab')}
          >
            <FaLayerGroup className="tab-button-icon" />
            <span>{t('common.decksTab')}</span>
            {currentDeckLength > 0 && (
              <span key={currentDeckLength} className="count-badge animate-pop relative">
                {currentDeckLength}
                {currentDeckLength === 1 && activeTab === 'search' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                )}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('collection')}
            className={`tab-button ${activeTab === 'collection' ? 'tab-button-active' : ''}`}
            aria-label={t('collection.title')}
          >
            <FaBoxOpen className="tab-button-icon" />
            <span>{t('collection.tab')}</span>
          </button>
        </nav>
        <div className="header-actions">
          <MobilePageMenu activeTab={activeTab} />
          <ProfileMenu isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
        </div>
      </div>

      {/* Only a reminder for when you're away from the deck editor — on the
          deck and collection tabs the editor UI already makes it obvious. */}
      {editingDeck.deckId && activeTab === 'search' && (
        <EditingDeckBanner
          deckName={editingDeck.deckName}
          deckFormat={editingDeck.deckFormat}
          onCancelEdit={onCancelEdit}
        />
      )}
    </header>
  );
};

export default Header;
