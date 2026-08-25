import { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCog } from 'react-icons/fa';
import { PrintZoneFilter } from '../../types/enums';
import {
  SpacingOption,
  CuttingGuide,
  PageSizeOption,
  OrientationOption,
  CARDS_PER_ROW_OPTIONS
} from '../../hooks/useProxyPrint';

interface ProxyPrintSettingsBarProps {
  useRealSize: boolean;
  setUseRealSize: Dispatch<SetStateAction<boolean>>;
  zoneFilter: PrintZoneFilter;
  setZoneFilter: Dispatch<SetStateAction<PrintZoneFilter>>;
  pageSize: PageSizeOption;
  setPageSize: Dispatch<SetStateAction<PageSizeOption>>;
  orientation: OrientationOption;
  setOrientation: Dispatch<SetStateAction<OrientationOption>>;
  cardsPerRow: number;
  setCardsPerRow: Dispatch<SetStateAction<number>>;
  spacing: SpacingOption;
  setSpacing: Dispatch<SetStateAction<SpacingOption>>;
  cuttingGuide: CuttingGuide;
  setCuttingGuide: Dispatch<SetStateAction<CuttingGuide>>;
  mainCount: number;
  sideboardCount: number;
  maybeboardCount: number;
  tokenCount: number;
}

/** The settings toolbar for the proxy-print modal (zone, paper, orientation, layout, guides). */
export function ProxyPrintSettingsBar({
  useRealSize,
  setUseRealSize,
  zoneFilter,
  setZoneFilter,
  pageSize,
  setPageSize,
  orientation,
  setOrientation,
  cardsPerRow,
  setCardsPerRow,
  spacing,
  setSpacing,
  cuttingGuide,
  setCuttingGuide,
  mainCount,
  sideboardCount,
  maybeboardCount,
  tokenCount
}: ProxyPrintSettingsBarProps) {
  const { t } = useTranslation();

  return (
    <div className="proxy-settings-bar flex-wrap">
      <div className="flex items-center gap-2 pr-2 border-r border-gray-200 dark:border-gray-700 mr-2">
        <FaCog className="text-gray-400 text-sm shrink-0" />
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useRealSize}
            onChange={(e) => setUseRealSize(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-750 text-primary focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer bg-white dark:bg-gray-800"
          />
          <span className="text-[11px] font-extrabold text-primary dark:text-blue-400 uppercase tracking-wider">
            {t('print.printRealSize')}
          </span>
        </label>
      </div>

      <div className="proxy-setting-group">
        <label className="proxy-setting-label">{t('print.selectZoneToPrint')}</label>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value as PrintZoneFilter)}
          className="proxy-select"
        >
          <optgroup label={t('print.printGroupSingle')}>
            <option value={PrintZoneFilter.ALL}>{t('print.printZoneAll')}</option>
            <option
              value={PrintZoneFilter.MAIN}
              label={
                mainCount > 0 ? t('deck.printFilters.mainCount', { count: mainCount }) : t('deck.printFilters.main')
              }
            />
            <option
              value={PrintZoneFilter.SIDEBOARD}
              label={
                sideboardCount > 0
                  ? t('deck.printFilters.sideboardCount', { count: sideboardCount })
                  : t('deck.printFilters.sideboard')
              }
            />
            <option
              value={PrintZoneFilter.MAYBEBOARD}
              label={
                maybeboardCount > 0
                  ? t('deck.printFilters.maybeboardCount', { count: maybeboardCount })
                  : t('deck.printFilters.maybeboard')
              }
            />
            {tokenCount > 0 && <option value={PrintZoneFilter.TOKENS}>{t('print.printZoneTokens')}</option>}
          </optgroup>
          <optgroup label={t('print.printGroupCombined')}>
            {mainCount > 0 && sideboardCount > 0 && (
              <option
                value={PrintZoneFilter.MAIN_SIDEBOARD}
                label={t('deck.printFilters.mainAndSideCount', { count: mainCount + sideboardCount })}
              />
            )}
            {mainCount > 0 && tokenCount > 0 && (
              <option value={PrintZoneFilter.MAIN_TOKENS}>{t('print.printZoneMainTokens')}</option>
            )}
            {mainCount > 0 && maybeboardCount > 0 && (
              <option
                value={PrintZoneFilter.MAIN_MAYBEBOARD}
                label={t('deck.printFilters.mainAndMaybeCount', { count: mainCount + maybeboardCount })}
              />
            )}
            {sideboardCount > 0 && maybeboardCount > 0 && (
              <option
                value={PrintZoneFilter.SIDEBOARD_MAYBEBOARD}
                label={t('deck.printFilters.sideAndMaybeCount', { count: sideboardCount + maybeboardCount })}
              />
            )}
            {sideboardCount > 0 && maybeboardCount > 0 && mainCount > 0 && (
              <option
                value={PrintZoneFilter.MAIN_SIDEBOARD_MAYBEBOARD}
                label={t('deck.printFilters.mainSideMaybeCount', {
                  count: mainCount + sideboardCount + maybeboardCount
                })}
              />
            )}
          </optgroup>
        </select>
      </div>

      <div className="proxy-setting-group">
        <label className="proxy-setting-label">{t('print.paperSize')}</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value as PageSizeOption)}
          className="proxy-select"
        >
          <option value="a4">{t('print.paperSizeA4')}</option>
          <option value="a5">{t('print.paperSizeA5')}</option>
          <option value="letter">{t('print.paperSizeLetter')}</option>
          <option value="legal">{t('print.paperSizeLegal')}</option>
        </select>
      </div>

      <div className="proxy-setting-group">
        <label className="proxy-setting-label">{t('print.orientation')}</label>
        <select
          value={orientation}
          onChange={(e) => setOrientation(e.target.value as OrientationOption)}
          className="proxy-select"
        >
          <option value="portrait">{t('print.portrait')}</option>
          <option value="landscape">{t('print.landscape')}</option>
        </select>
      </div>

      <div
        className={`proxy-setting-group transition-all duration-200 ${useRealSize ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <label className="proxy-setting-label">{t('print.cardsPerRow')}</label>
        <div className="flex gap-1">
          {CARDS_PER_ROW_OPTIONS.map((cardsPerRowOption) => (
            <button
              key={cardsPerRowOption}
              type="button"
              disabled={useRealSize}
              onClick={() => setCardsPerRow(cardsPerRowOption)}
              className={`proxy-option-btn ${cardsPerRow === cardsPerRowOption ? 'proxy-option-btn-active' : ''}`}
            >
              {cardsPerRowOption}
            </button>
          ))}
        </div>
      </div>

      <div className="proxy-setting-group">
        <label className="proxy-setting-label">{t('print.printSpacing')}</label>
        <div className="flex gap-1">
          {(['none', 'small', 'large'] as SpacingOption[]).map((spacingOptionValue) => (
            <button
              key={spacingOptionValue}
              type="button"
              onClick={() => setSpacing(spacingOptionValue)}
              className={`proxy-option-btn ${spacing === spacingOptionValue ? 'proxy-option-btn-active' : ''}`}
            >
              {t(
                `print.spacing${spacingOptionValue.charAt(0).toUpperCase() + spacingOptionValue.slice(1)}` as
                  'print.spacingNone' | 'print.spacingSmall' | 'print.spacingLarge'
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="proxy-setting-group">
        <label className="proxy-setting-label">{t('print.cuttingGuide')}</label>
        <div className="flex gap-1">
          {(['none', 'solid', 'dotted'] as CuttingGuide[]).map((guideOption) => (
            <button
              key={guideOption}
              type="button"
              onClick={() => setCuttingGuide(guideOption)}
              className={`proxy-option-btn ${cuttingGuide === guideOption ? 'proxy-option-btn-active' : ''}`}
            >
              {t(
                guideOption === 'none'
                  ? 'print.cuttingGuideNone'
                  : guideOption === 'solid'
                    ? 'print.cuttingGuideLine'
                    : 'print.cuttingGuideDotted'
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
