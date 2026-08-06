import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FaUser,
  FaChevronDown,
  FaInfoCircle,
  FaKeyboard,
  FaGithub,
  FaTimes,
  FaMoon,
  FaSun,
  FaGlobeAmericas,
  FaCheck,
  FaMagic,
  FaDownload
} from 'react-icons/fa';
import enFlag from '../../assets/locales/en.svg';
import ptFlag from '../../assets/locales/pt.svg';
import esFlag from '../../assets/locales/es.svg';

interface ProfileMenuProps {
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
}

import { APP_VERSION, AUTHOR_NAME, GITHUB_REPO_URL, APP_NAME } from '../../constants';
import { useVisualEffects } from '../../hooks/useVisualEffects';
import useInstallPrompt from '../../hooks/useInstallPrompt';

function ProfileMenu({ isDarkMode, setIsDarkMode }: ProfileMenuProps) {
  const { t, i18n } = useTranslation();
  const { effectsEnabled, setEffectsEnabled } = useVisualEffects();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'main' | 'about' | 'help' | 'language'>('main');
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

  const languages = [
    {
      key: 'en',
      label: 'English',
      iconPath: enFlag
    },
    {
      key: 'pt',
      label: 'Português',
      iconPath: ptFlag
    },
    {
      key: 'es',
      label: 'Español',
      iconPath: esFlag
    }
  ];

  const currentLang = languages.find((l) => l.key === (i18n.language?.split('-')[0] || 'en')) || languages[0];

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
            <>
              <div className="profile-menu-header">
                <div className="flex items-center gap-3">
                  <div className="profile-avatar-lg">
                    <FaUser className="text-sm text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{APP_NAME}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('strategy.version')} {APP_VERSION}
                    </p>
                  </div>
                </div>
              </div>

              <div className="profile-menu-divider" />

              <div className="profile-menu-row">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  {isDarkMode ? (
                    <FaMoon className="text-indigo-400 text-sm" />
                  ) : (
                    <FaSun className="text-amber-400 text-sm" />
                  )}
                  <span className="text-sm font-medium">
                    {isDarkMode ? t('common.darkMode') : t('common.lightMode')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`profile-toggle ${isDarkMode ? 'profile-toggle-on' : 'profile-toggle-off'}`}
                  aria-label={isDarkMode ? t('common.lightMode') : t('common.darkMode')}
                >
                  <span className={`profile-toggle-thumb ${isDarkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="profile-menu-row">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <FaMagic className={`text-sm ${effectsEnabled ? 'text-fuchsia-400' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">{t('common.visualEffects')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEffectsEnabled(!effectsEnabled)}
                  className={`profile-toggle ${effectsEnabled ? 'profile-toggle-on' : 'profile-toggle-off'}`}
                  aria-label={t('common.visualEffects')}
                  aria-pressed={effectsEnabled}
                >
                  <span className={`profile-toggle-thumb ${effectsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <button
                type="button"
                className="profile-menu-item"
                onClick={() => setActiveSection('language')}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <FaGlobeAmericas className="text-blue-500 text-sm shrink-0" />
                  <span>{t('common.language')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <img
                    src={currentLang.iconPath}
                    alt={currentLang.label}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{currentLang.label}</span>
                  <FaChevronDown className="text-gray-400 text-xs -rotate-90" />
                </div>
              </button>

              {canInstall ? (
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => {
                    promptInstall();
                    setIsOpen(false);
                  }}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2">
                    <FaDownload className="text-blue-500 text-sm shrink-0" />
                    <span>{t('common.installApp')}</span>
                  </div>
                </button>
              ) : null}

              <div className="profile-menu-divider" />

              <button
                type="button"
                className="profile-menu-item"
                onClick={() => setActiveSection('about')}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <FaInfoCircle className="text-purple-500 text-sm shrink-0" />
                  <span>{t('strategy.aboutApp')}</span>
                </div>
                <FaChevronDown className="text-gray-400 text-xs -rotate-90" />
              </button>

              {/* Keyboard-shortcuts reference — hidden below sm: no physical
                  keyboard on phone-width screens, so the shortcuts are unusable there. */}
              <button
                type="button"
                className="profile-menu-item hidden sm:flex"
                onClick={() => setActiveSection('help')}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <FaKeyboard className="text-green-500 text-sm shrink-0" />
                  <span>{t('common.help')}</span>
                </div>
                <FaChevronDown className="text-gray-400 text-xs -rotate-90" />
              </button>

              <a
                href="https://github.com/AleBL/magic-the-gathering-search"
                target="_blank"
                rel="noopener noreferrer"
                className="profile-menu-item"
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <FaGithub className="text-gray-600 dark:text-gray-300 text-sm shrink-0" />
                  <span>{t('strategy.gitHub')}</span>
                </div>
                <span className="text-xs text-gray-400">↗</span>
              </a>
            </>
          ) : null}

          {activeSection === 'language' ? (
            <>
              <div className="profile-menu-back-header">
                <button type="button" onClick={() => setActiveSection('main')} className="profile-back-btn">
                  <FaChevronDown className="rotate-90 text-xs" />
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{t('common.language')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setActiveSection('main');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
              <div className="profile-menu-divider" />
              {languages.map((lang) => (
                <button
                  key={lang.key}
                  type="button"
                  onClick={() => changeLanguage(lang.key)}
                  className="profile-menu-item"
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5">
                    <img src={lang.iconPath} alt={lang.label} className="w-5 h-5 rounded-full object-cover shadow-sm" />
                    <span className="font-medium text-gray-800 dark:text-gray-200">{lang.label}</span>
                  </div>
                  {currentLang.key === lang.key ? <FaCheck className="text-blue-500 text-xs" /> : null}
                </button>
              ))}
            </>
          ) : null}

          {activeSection === 'about' ? (
            <>
              <div className="profile-menu-back-header">
                <button type="button" onClick={() => setActiveSection('main')} className="profile-back-btn">
                  <FaChevronDown className="rotate-90 text-xs" />
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{t('strategy.aboutApp')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setActiveSection('main');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
              <div className="profile-menu-divider" />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="profile-avatar-lg">
                    <FaUser className="text-sm text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{APP_NAME}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('strategy.version')} {APP_VERSION} · MIT
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t('strategy.appDescription')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">{AUTHOR_NAME}</p>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-blue-400 hover:underline"
                >
                  <FaGithub />
                  {t('strategy.gitHub')}
                </a>
              </div>
            </>
          ) : null}

          {activeSection === 'help' ? (
            <>
              <div className="profile-menu-back-header">
                <button type="button" onClick={() => setActiveSection('main')} className="profile-back-btn">
                  <FaChevronDown className="rotate-90 text-xs" />
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {t('strategy.keyboardShortcuts')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setActiveSection('main');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
              <div className="profile-menu-divider" />
              <div className="p-4 space-y-2.5">
                {shortcuts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{sc.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ProfileMenu;
