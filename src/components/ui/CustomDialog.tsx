import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { AlertVariant } from '../../types';
import { WindowWithElectronAPI } from '../../types/electron';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface CustomDialogProps {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: AlertVariant;
}

function CustomDialog({
  isOpen,
  type,
  title,
  message,
  onConfirm,
  onCancel,
  variant = AlertVariant.INFO
}: CustomDialogProps) {
  const { t } = useTranslation();

  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const alertBtnRef = useRef<HTMLButtonElement>(null);
  useEscapeKey(onCancel, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    // Show native OS notification
    const safeWindow = window as unknown as WindowWithElectronAPI;
    if (safeWindow.electronAPI) {
      safeWindow.electronAPI.send('show-notification', { title, body: message });
    } else if (window.Notification) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body: message });
          }
        });
      }
    }

    // Focus the primary button (overrides useFocusTrap's default first-element focus)
    if (type === 'confirm') {
      confirmBtnRef.current?.focus();
    } else {
      alertBtnRef.current?.focus();
    }
  }, [isOpen, title, message, type]);

  if (!isOpen) return null;

  const iconMap = {
    [AlertVariant.DANGER]: <FaExclamationTriangle className="text-red-500 text-3xl shrink-0" />,
    [AlertVariant.WARNING]: <FaExclamationTriangle className="text-amber-500 text-3xl shrink-0" />,
    [AlertVariant.SUCCESS]: <FaCheckCircle className="text-green-500 text-3xl shrink-0" />,
    [AlertVariant.INFO]: <FaInfoCircle className="text-blue-500 text-3xl shrink-0" />
  };

  return createPortal(
    // Backdrop click is a mouse-only convenience; Escape and the close button provide the keyboard-equivalent action.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="modal-overlay animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-container modal-container-small animate-slide-in relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Top Accent Line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            variant === AlertVariant.DANGER
              ? 'bg-red-500'
              : variant === AlertVariant.WARNING
                ? 'bg-amber-500'
                : variant === AlertVariant.SUCCESS
                  ? 'bg-green-500'
                  : 'bg-blue-500'
          }`}
        />

        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label={t('common.close')}
        >
          <FaTimes className="text-base" />
        </button>

        <div className="flex gap-4 pt-2">
          {iconMap[variant]}
          <div className="flex-1 space-y-2">
            <h3
              id="dialog-title"
              className="text-lg font-bold text-gray-900 dark:text-white transition-colors duration-300"
            >
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-300 whitespace-pre-line leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          {type === 'confirm' ? (
            <>
              <button type="button" onClick={onCancel} className="secondary-button py-2 px-4 text-sm font-medium">
                {t('common.cancel')}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={onConfirm}
                className={`${
                  variant === AlertVariant.DANGER
                    ? 'danger-button'
                    : variant === AlertVariant.WARNING
                      ? 'warning-button'
                      : variant === AlertVariant.SUCCESS
                        ? 'success-button'
                        : 'primary-button'
                } py-2 px-4 text-sm font-medium`}
              >
                {t('common.confirm')}
              </button>
            </>
          ) : (
            <button
              ref={alertBtnRef}
              type="button"
              onClick={onConfirm}
              className="primary-button py-2 px-4 text-sm font-medium"
            >
              {t('common.ok')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) as unknown as ReactNode;
}

export default CustomDialog;
