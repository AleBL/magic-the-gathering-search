import { version as packageVersion, productName as appName, author, repository } from '../../package.json';
import { CardSize, SearchFilters } from '../types';

export const APP_VERSION = packageVersion;
export const APP_NAME = appName;
export const AUTHOR_NAME = author.name;
export const GITHUB_REPO_URL = repository.url;

export const CARD_SIZES: readonly CardSize[] = ['small', 'medium', 'large', 'xlarge'] as const;

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  colors: [],
  types: [],
  rarity: '',
  cmc: '',
  text: '',
  excludeText: '',
  keyword: '',
  oracleTag: '',
  power: '',
  toughness: ''
};

export const TOAST_DURATION_MS = 2500;

export const SUPPORTED_LANGUAGES = ['en', 'pt', 'es'] as const;

export const BASIC_LAND_NAMES: readonly string[] = [
  'Plains',
  'Island',
  'Swamp',
  'Mountain',
  'Forest',
  'Wastes',
  'Planície',
  'Ilha',
  'Pântano',
  'Montanha',
  'Floresta',
  'Ermo',
  'Ermos'
] as const;

export const MIN_DECK_SIZE = 60;
export const COMMANDER_DECK_SIZE = 100;

// 1 above the --z-playtest CSS variable (99999) so card details render above the fullscreen playtest overlay.
export const PLAYTEST_CARD_DETAIL_Z_INDEX = 100000;

export const PLAYTEST_CONTEXT_MENU_EDGE_MARGIN_PX = 10;

export const PLAYTEST_CARD_SIZE_CLASSES = 'w-28 sm:w-32 md:w-36 lg:w-40 xl:w-48 aspect-[5/7]';

export const PLAYTEST_PILE_SIZE_CLASSES = 'w-24 sm:w-28 md:w-32 lg:w-36 xl:w-40 2xl:w-40 aspect-[5/7]';
