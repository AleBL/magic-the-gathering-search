import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUser, FaChevronDown } from 'react-icons/fa';
import { useVisualEffects } from '../../hooks/useVisualEffects';
import useInstallPrompt from '../../hooks/useInstallPrompt';
import { PROFILE_MENU_LANGUAGES } from './profileMenuLanguages';
import { ProfileMenuMainSection } from './ProfileMenuMainSection';
import { ProfileMenuLanguageSection } from './ProfileMenuLanguageSection';
import { ProfileMenuBackupSection } from './ProfileMenuBackupSection';
import { ProfileMenuAboutSection } from './ProfileMenuAboutSection';
import { ProfileMenuHelpSection } from './ProfileMenuHelpSection';

interface ProfileMenuProps {
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
}

function ProfileMenu({ isDarkMode, setIsDarkMode }: ProfileMenuProps) {
  const { t, i18n } = useTranslation();
  const { effectsEnabled, setEffectsEnabled } = useVisualEffects();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'main' | 'about' | 'help' | 'language' | 'backup'>('main');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveSection('main');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang =
    PROFILE_MENU_LANGUAGES.find((l) => l.key === (i18n.language?.split('-')[0] || 'en')) || PROFILE_MENU_LANGUAGES[0];

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setActiveSection('main');
  };

  const shortcuts = [
    { keys: ['Ctrl', 'F'], label: t('strategy.shortcutSearch') },
    { keys: ['Ctrl', 'S'], label: t('strategy.shortcutSave') },
    { keys: ['Ctrl', 'P'], label: t('strategy.shortcutPlaytest') },
    { keys: ['Ctrl', 'Shift', 'N'], label: t('strategy.shortcutClear') }
  ];

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    if (isOpen) setActiveSection('main');
  };

  const closeMenu = () => {
    setIsOpen(false);
    setActiveSection('main');
  };

  const backToMain = () => setActiveSection('main');

  return (
    <div className="profile-menu-wrapper" ref={menuRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="profile-menu-trigger"
        aria-label={t('strategy.profileMenu')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t('strategy.profileMenu')}
      >
        <div className="profile-avatar">
          <FaUser className="text-xs text-white" />
        </div>
        <FaChevronDown
          className={`text-gray-500 dark:text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen ? (
        <div className="profile-menu-panel animate-dropdownEnter origin-top-right z-[var(--z-modal)]" role="menu">
          {activeSection === 'main' ? (
            <ProfileMenuMainSection
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              effectsEnabled={effectsEnabled}
              setEffectsEnabled={setEffectsEnabled}
              currentLang={currentLang}
              canInstall={canInstall}
              onInstall={() => {
                promptInstall();
                setIsOpen(false);
              }}
              onOpenLanguage={() => setActiveSection('language')}
              onOpenBackup={() => setActiveSection('backup')}
              onOpenAbout={() => setActiveSection('about')}
              onOpenHelp={() => setActiveSection('help')}
            />
          ) : null}

          {activeSection === 'language' ? (
            <ProfileMenuLanguageSection
              currentLang={currentLang}
              onSelectLanguage={changeLanguage}
              onBack={backToMain}
              onClose={closeMenu}
            />
          ) : null}

          {activeSection === 'backup' ? <ProfileMenuBackupSection onBack={backToMain} onClose={closeMenu} /> : null}

          {activeSection === 'about' ? <ProfileMenuAboutSection onBack={backToMain} onClose={closeMenu} /> : null}

          {activeSection === 'help' ? (
            <ProfileMenuHelpSection shortcuts={shortcuts} onBack={backToMain} onClose={closeMenu} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ProfileMenu;
