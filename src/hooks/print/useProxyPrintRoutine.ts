import { useCallback, useRef, useState } from 'react';
import { CSS_PAGE_SIZE_MAP, OrientationOption, PageSizeOption } from '../../utils/proxyPrintLayout';

const PRINT_STYLE_ID = 'proxy-print-override';
const IMAGE_WAIT_TIMEOUT_MS = 8000;
const STYLE_CLEANUP_DELAY_MS = 500;

/**
 * Resolves once every image inside the print root has settled. A half-loaded image prints as
 * a blank card, and the browser's print dialog does not wait for the network.
 */
function waitForImages(printRoot: HTMLElement | null): Promise<void> {
  if (!printRoot) return Promise.resolve();
  const pending = Array.from(printRoot.querySelectorAll('img')).filter((image) => !image.complete);
  if (pending.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = 0;
    const countOne = () => {
      settled += 1;
      if (settled >= pending.length) resolve();
    };
    pending.forEach((image) => {
      image.addEventListener('load', countOne, { once: true });
      image.addEventListener('error', countOne, { once: true });
    });
    setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS);
  });
}

// Hides everything except the print root and sets the paper size, since `window.print()`
// otherwise pages the whole app layout, scrollbars and all.
const printOverrideCss = (pageSize: PageSizeOption, orientation: OrientationOption): string => `
      @media print {
        html, body {
          height: auto !important;
          min-height: 100% !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
        body > *:not(#proxy-print-root) {
          display: none !important;
        }
        #proxy-print-root {
          display: block !important;
          position: static !important;
          width: auto !important;
          height: auto !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          visibility: visible !important;
        }
        #proxy-print-root * { visibility: visible !important; }
        @page {
          size: ${CSS_PAGE_SIZE_MAP[pageSize]} ${orientation};
          margin: 0mm;
        }
      }
    `;

export function useProxyPrintRoutine(pageSize: PageSizeOption, orientation: OrientationOption) {
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const printRootRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    await waitForImages(printRootRef.current);

    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = printOverrideCss(pageSize, orientation);
    document.head.appendChild(style);

    // Two frames: the first commits the print layout, the second lets it paint before the
    // print dialog freezes the page — printing on the same frame captured the old layout.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setTimeout(() => {
          document.getElementById(PRINT_STYLE_ID)?.remove();
          setIsPrinting(false);
        }, STYLE_CLEANUP_DELAY_MS);
      });
    });
  }, [pageSize, orientation]);

  return { isPrinting, printRootRef, handlePrint };
}
