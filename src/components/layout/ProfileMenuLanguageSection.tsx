import { useTranslation } from 'react-i18next';
import { FaCheck } from 'react-icons/fa';
import { ProfileMenuBackHeader } from './ProfileMenuBackHeader';
import { PROFILE_MENU_LANGUAGES, ProfileMenuLanguageOption } from './profileMenuLanguages';

interface ProfileMenuLanguageSectionProps {
  readonly currentLang: ProfileMenuLanguageOption;
  readonly onSelectLanguage: (key: string) => void;
  readonly onBack: () => void;
  readonly onClose: () => void;
}

export function ProfileMenuLanguageSection({
  currentLang,
  onSelectLanguage,
  onBack,
  onClose
}: ProfileMenuLanguageSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <ProfileMenuBackHeader title={t('common.language')} onBack={onBack} onClose={onClose} />
      <div className="profile-menu-divider" />
      {PROFILE_MENU_LANGUAGES.map((lang) => (
        <button
          key={lang.key}
          type="button"
          onClick={() => onSelectLanguage(lang.key)}
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
  );
}
