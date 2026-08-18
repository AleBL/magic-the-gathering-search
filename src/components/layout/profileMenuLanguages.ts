import enFlag from '../../assets/locales/en.svg';
import ptFlag from '../../assets/locales/pt.svg';
import esFlag from '../../assets/locales/es.svg';

export interface ProfileMenuLanguageOption {
  readonly key: string;
  readonly label: string;
  readonly iconPath: string;
}

export const PROFILE_MENU_LANGUAGES: ProfileMenuLanguageOption[] = [
  { key: 'en', label: 'English', iconPath: enFlag },
  { key: 'pt', label: 'Português', iconPath: ptFlag },
  { key: 'es', label: 'Español', iconPath: esFlag }
];
