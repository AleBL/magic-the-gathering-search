import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaPrint, FaTimes, FaInfoCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { Card } from '../../types/Card';
import { DeckRelatedToken } from '../../types/Deck';
import { DeckZone } from '../../types/enums';
import { useProxyPrint, resolveFaceImageUrl } from '../../hooks/useProxyPrint';
import { ProxyPrintSettingsBar } from '../deck/ProxyPrintSettingsBar';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface DeckProxyPrintProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  deckName?: string;
  deckRelatedTokens?: DeckRelatedToken[];
  defaultZone?: DeckZone;
}

function DeckProxyPrint({
  isOpen,
  onClose,
  cards,
  deckRelatedTokens = [],
  defaultZone = DeckZone.MAIN
}: DeckProxyPrintProps) {
  const { t } = useTranslation();
  const {
    useRealSize,
    setUseRealSize,
    spacing,
    setSpacing,
    cuttingGuide,
    setCuttingGuide,
    cardsPerRow,
    setCardsPerRow,
    zoneFilter,
    setZoneFilter,
    pageSize,
    setPageSize,
    orientation,
    setOrientation,
    isPrinting,
    printRootRef,
    tokenCards,
    mainCards,
    sideboardCards,
    maybeboardCards,
    calculatedColumns,
    calculatedRows,
    cardsPerPage,
    cssGridGapValue,
    printGridGapValue,
    borderStyle,
    facesToPrint,
    chunkedCards,
    estimatedPages,
    currentPaperWidthMm,
    currentPaperHeightMm,
    handlePrint
  } = useProxyPrint({ cards, deckRelatedTokens, defaultZone });

  // Mounted even while closed (it renders null), so both are gated on isOpen.
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay animate-fadeIn" style={{ zIndex: 9999 }}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="proxy-print-title"
          className="proxy-modal-container"
        >
          <div className="modal-header-container">
            <h3
              id="proxy-print-title"
              className="text-gray-900 dark:text-white text-lg font-bold flex items-center gap-2"
            >
              <FaPrint className="text-blue-500" />
              {t('print.printProxiesTitle')}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <FaTimes />
            </button>
          </div>

          <ProxyPrintSettingsBar
            useRealSize={useRealSize}
            setUseRealSize={setUseRealSize}
            zoneFilter={zoneFilter}
            setZoneFilter={setZoneFilter}
            pageSize={pageSize}
            setPageSize={setPageSize}
            orientation={orientation}
            setOrientation={setOrientation}
            cardsPerRow={cardsPerRow}
            setCardsPerRow={setCardsPerRow}
            spacing={spacing}
            setSpacing={setSpacing}
            cuttingGuide={cuttingGuide}
            setCuttingGuide={setCuttingGuide}
            mainCount={mainCards.length}
            sideboardCount={sideboardCards.length}
            maybeboardCount={maybeboardCards.length}
            tokenCount={tokenCards.length}
          />

          {useRealSize ? (
            <div className="mx-6 my-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex flex-col sm:flex-row gap-3 items-start sm:items-center text-xs animate-fadeIn">
              <FaInfoCircle className="text-blue-500 shrink-0 text-lg" />
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                <strong>{t('print.realSizeGuaranteed')} (63x88mm):</strong> {t('print.printInstructionsText')}{' '}
                <strong className="text-gray-900 dark:text-white underline">{t('print.scaleOption')}</strong>{' '}
                {t('print.printInstructionsTextSuffix')}
              </div>
              <div className="text-blue-700 dark:text-blue-300 font-medium whitespace-nowrap bg-blue-100 dark:bg-blue-800/50 px-2 py-1 rounded">
                {cardsPerPage} {t('print.cardsPerPageTextSuffix')}
              </div>
            </div>
          ) : (
            <div className="mx-6 my-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex flex-col sm:flex-row gap-3 items-start sm:items-center text-xs animate-fadeIn">
              <FaExclamationTriangle className="text-amber-500 shrink-0 text-lg" />
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                <strong>{t('print.customSizeLabel')}</strong> {t('print.customSizeWarning')}
              </div>
              <div className="text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap bg-amber-100 dark:bg-amber-800/50 px-2 py-1 rounded">
                {cardsPerPage} {t('print.cardsPerPageSimple')}
              </div>
            </div>
          )}

          <div className="proxy-preview-scroll">
            <div className="flex flex-col items-center gap-8 py-6 bg-slate-900/10 dark:bg-slate-950/20 rounded-xl p-4">
              {chunkedCards.length === 0 ? (
                <div className="text-gray-500 py-12">{t('search.noResults')}</div>
              ) : (
                chunkedCards.map((pageCards, pageIndex) => (
                  <div
                    key={pageIndex}
                    className="bg-white text-slate-950 shadow-2xl border border-gray-300 dark:border-slate-800 relative flex flex-col shrink-0 select-none rounded-lg p-6 transition-all duration-300 transform hover:scale-[1.01]"
                    style={{
                      width: orientation === 'portrait' ? '170mm' : '240mm',
                      aspectRatio: orientation === 'portrait' ? '210/297' : '297/210',
                      padding: '5mm',
                      boxSizing: 'border-box'
                    }}
                  >
                    <span className="absolute -top-3 -left-3 bg-primary text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg shadow-md z-10 select-none">
                      PÁG. {pageIndex + 1} / {estimatedPages}
                    </span>

                    <div
                      className="grid w-full h-full"
                      style={{
                        gridTemplateColumns: `repeat(${calculatedColumns}, 1fr)`,
                        gridTemplateRows: useRealSize
                          ? `repeat(${calculatedRows}, minmax(0, 1fr))`
                          : `repeat(${calculatedRows}, max-content)`,
                        alignContent: useRealSize ? 'center' : 'start',
                        gap: cssGridGapValue,
                        justifyContent: 'center'
                      }}
                    >
                      {pageCards.map(({ card, faceIndex }, cardIndex) => {
                        const cardImageUrl = resolveFaceImageUrl(card, faceIndex);
                        return (
                          <div
                            key={cardIndex}
                            className="proxy-card-cell border"
                            style={{
                              aspectRatio: '63/88',
                              border: borderStyle,
                              borderRadius: cuttingGuide !== 'none' ? '4px' : '0'
                            }}
                          >
                            {cardImageUrl ? (
                              <img src={cardImageUrl} alt={card.name} className="proxy-card-image" />
                            ) : (
                              <div className="proxy-card-placeholder">
                                <span className="text-[10px] text-gray-400 text-center px-1 font-bold">
                                  {card.name}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer-container">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 text-left">
              {facesToPrint.length} {t('common.cards')} &bull; {t('print.estimatedPages')}{' '}
              <span className="font-bold text-gray-700 dark:text-gray-300">{estimatedPages}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={isPrinting}
              className="secondary-button text-xs py-2 px-4"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="primary-button text-xs py-2 px-4 flex items-center gap-2"
            >
              {isPrinting ? (
                <FaSpinner className="text-xs shrink-0 animate-spin" />
              ) : (
                <FaPrint className="text-xs shrink-0" />
              )}
              {isPrinting ? t('print.preparing') : t('print.printAll')}
            </button>
          </div>
        </div>
      </div>

      {/* Print-only DOM node — visible to browser (so images load) but invisible on screen */}
      {createPortal(
        <div
          ref={printRootRef}
          id="proxy-print-root"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            background: 'white',
            zIndex: -1,
            pointerEvents: 'none',
            visibility: 'hidden'
          }}
        >
          {chunkedCards.map((pageCards, pageIndex) => (
            <div
              key={pageIndex}
              className="print-page"
              style={{
                width: orientation === 'portrait' ? `${currentPaperWidthMm}mm` : `${currentPaperHeightMm}mm`,
                height: orientation === 'portrait' ? `${currentPaperHeightMm}mm` : `${currentPaperWidthMm}mm`,
                padding: '5mm',
                boxSizing: 'border-box',
                pageBreakAfter: 'always',
                breakAfter: 'page',
                display: 'grid',
                gridTemplateColumns: useRealSize
                  ? `repeat(${calculatedColumns}, 63mm)`
                  : `repeat(${calculatedColumns}, 1fr)`,
                gridTemplateRows: useRealSize
                  ? `repeat(${calculatedRows}, 88mm)`
                  : `repeat(${calculatedRows}, max-content)`,
                alignContent: useRealSize ? 'center' : 'start',
                gap: useRealSize ? printGridGapValue : cssGridGapValue,
                justifyContent: 'center',
                background: 'white',
                overflow: 'hidden'
              }}
            >
              {pageCards.map(({ card, faceIndex, id }, cardIndex) => {
                const cardImageUrl = resolveFaceImageUrl(card, faceIndex);

                return (
                  <div
                    key={`print-${id}-${cardIndex}`}
                    style={{
                      width: useRealSize ? '63mm' : '100%',
                      height: useRealSize ? '88mm' : 'auto',
                      aspectRatio: useRealSize ? 'auto' : '63/88',
                      boxSizing: 'border-box',
                      border: borderStyle,
                      borderRadius: cuttingGuide !== 'none' ? '1.5mm' : '0',
                      overflow: 'hidden',
                      breakInside: 'avoid',
                      background: '#1a1a1a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      alignSelf: 'center'
                    }}
                  >
                    {cardImageUrl ? (
                      <img
                        src={cardImageUrl}
                        alt={card.name}
                        loading="eager"
                        decoding="sync"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: '8px',
                          color: '#aaa',
                          textAlign: 'center',
                          padding: '4px',
                          fontFamily: 'system-ui, sans-serif'
                        }}
                      >
                        {card.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default DeckProxyPrint;
