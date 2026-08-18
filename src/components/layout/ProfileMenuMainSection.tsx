import { useTranslation } from 'react-i18next';
import {
  FaUser,
  FaInfoCircle,
  FaKeyboard,
  FaGithub,
  FaMoon,
  FaSun,
  FaGlobeAmericas,
  FaMagic,
  FaDownload,
  FaShieldAlt,
  FaChevronDown
} from 'react-icons/fa';
import { APP_VERSION, APP_NAME } from '../../constants';
import { ProfileMenuLanguageOption } from './profileMenuLanguages';

interface ProfileMenuMainSectionProps {
  readonly isDarkMode: boolean;
  readonly setIsDarkMode: (value: boolean) => void;
  readonly effectsEnabled: boolean;
  readonly setEffectsEnabled: (value: boolean) => void;
  readonly currentLang: ProfileMenuLanguageOption;
  readonly canInstall: boolean;
  readonly onInstall: () => void;
  readonly onOpenLanguage: () => void;
  readonly onOpenBackup: () => void;
  readonly onOpenAbout: () => void;
  readonly onOpenHelp: () => void;
}

/** The profile menu's landing list: theme/effects toggles and links into the other sections. */
export function ProfileMenuMainSection({
  isDarkMode,
  setIsDarkMode,
  effectsEnabled,
  setEffectsEnabled,
  currentLang,
  canInstall,
  onInstall,
  onOpenLanguage,
  onOpenBackup,
  onOpenAbout,
  onOpenHelp
}: ProfileMenuMainSectionProps) {
  const { t } = useTranslation();

  return (
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
          {isDarkMode ? <FaMoon className="text-indigo-400 text-sm" /> : <FaSun className="text-amber-400 text-sm" />}
          <span className="text-sm font-medium">{isDarkMode ? t('common.darkMode') : t('common.lightMode')}</span>
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

      <button type="button" className="profile-menu-item" onClick={onOpenLanguage} role="menuitem">
        <div className="flex items-center gap-2">
          <FaGlobeAmericas className="text-blue-500 text-sm shrink-0" />
          <span>{t('common.language')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <img src={currentLang.iconPath} alt={currentLang.label} className="w-4 h-4 rounded-full object-cover" />
          <span className="text-xs text-gray-500 dark:text-gray-400">{currentLang.label}</span>
          <FaChevronDown className="text-gray-400 text-xs -rotate-90" />
        </div>
      </button>

      {canInstall ? (
        <button type="button" className="profile-menu-item" onClick={onInstall} role="menuitem">
          <div className="flex items-center gap-2">
            <FaDownload className="text-blue-500 text-sm shrink-0" />
            <span>{t('common.installApp')}</span>
          </div>
        </button>
      ) : null}

      <div className="profile-menu-divider" />

      <button type="button" className="profile-menu-item" onClick={onOpenBackup} role="menuitem">
        <div className="flex items-center gap-2">
          <FaShieldAlt className="text-blue-500 text-sm shrink-0" />
          <span>{t('backup.title')}</span>
        </div>
        <FaChevronDown className="text-gray-400 text-xs -rotate-90" />
      </button>

      <button type="button" className="profile-menu-item" onClick={onOpenAbout} role="menuitem">
        <div className="flex items-center gap-2">
          <FaInfoCircle className="text-purple-500 text-sm shrink-0" />
          <span>{t('strategy.aboutApp')}</span>
        </div>
        <FaChevronDown className="text-gray-400 text-xs -rotate-90" />
      </button>

      {/* Keyboard-shortcuts reference — hidden below sm: no physical
          keyboard on phone-width screens, so the shortcuts are unusable there. */}
      <button type="button" className="profile-menu-item hidden sm:flex" onClick={onOpenHelp} role="menuitem">
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
  );
}

export default ProfileMenuMainSection;
