import { logger } from '../../utils/logger';
import { Component, ErrorInfo, Fragment, ReactNode } from 'react';
import i18n from '../../plugins/i18n';
import ErrorState from '../ui/ErrorState';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * `page` (the default) is the last line of defence at the root: the whole screen is
   * gone, so the only honest offer is a reload.
   *
   * `section` wraps one part of the UI. Dexie's `useLiveQuery` throws during render, so
   * a failed IndexedDB read in the deck or collection panel propagates to the nearest
   * boundary — at the root that means one failed read blanks the entire app, header and
   * other tabs included. Scoped boundaries keep the damage inside the panel that broke
   * and offer a retry that remounts just that subtree.
   */
  variant?: 'page' | 'section';
}

interface ErrorBoundaryState {
  hasError: boolean;
  /** Bumped on retry so the children remount instead of re-rendering in a failed state. */
  resetKey: number;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled React error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState((previous) => ({ hasError: false, resetKey: previous.resetKey + 1 }));
  };

  render() {
    const isSection = this.props.variant === 'section';

    if (this.state.hasError) {
      return (
        <div
          className={
            isSection ? 'flex items-center justify-center p-8' : 'page-container flex items-center justify-center'
          }
        >
          <ErrorState
            title={i18n.t('common.somethingWentWrong') as string}
            message={i18n.t(isSection ? 'common.sectionErrorMessage' : 'common.errorBoundaryMessage') as string}
            onRetry={isSection ? this.handleRetry : this.handleReload}
            retryLabel={i18n.t(isSection ? 'common.tryAgain' : 'common.reload') as string}
          />
        </div>
      );
    }

    // Keyed so `handleRetry` genuinely remounts the subtree: without this the children
    // would re-render with whatever state caused the throw and fail again immediately.
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}

export default ErrorBoundary;
