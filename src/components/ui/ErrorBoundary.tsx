import { logger } from '../../utils/logger';
import { Component, ErrorInfo, ReactNode } from 'react';
import i18n from '../../plugins/i18n';
import ErrorState from '../ui/ErrorState';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled React error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container flex items-center justify-center">
          <ErrorState
            title={i18n.t('common.somethingWentWrong') as string}
            message={i18n.t('common.errorBoundaryMessage') as string}
            onRetry={this.handleReload}
            retryLabel={i18n.t('common.reload') as string}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
