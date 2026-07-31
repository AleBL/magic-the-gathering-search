import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

/**
 * Fails while `state.failing` is true. Keyed on an external flag rather than a render
 * count because React re-renders a throwing component while capturing it, which makes
 * counting renders an unreliable way to express "fails once".
 */
function FailsWhile({ state }: { state: { failing: boolean } }) {
  if (state.failing) throw new Error('IndexedDB read failed');
  return <p>panel content</p>;
}

function AlwaysFails(): React.ReactElement {
  throw new Error('IndexedDB read failed');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors; silence it so a passing run is not full of red noise.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>panel content</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('panel content')).toBeInTheDocument();
  });

  it('shows a fallback instead of propagating the error', () => {
    render(
      <ErrorBoundary variant="section">
        <AlwaysFails />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByText('panel content')).not.toBeInTheDocument();
  });

  // The point of the scoped variant: a failed read in one panel must not cost the user
  // the rest of the app, and must be recoverable without a full page reload.
  it('recovers a section by remounting the subtree, without reloading', async () => {
    const state = { failing: true };
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);

    render(
      <ErrorBoundary variant="section">
        <FailsWhile state={state} />
      </ErrorBoundary>
    );

    expect(screen.queryByText('panel content')).not.toBeInTheDocument();

    // Whatever made the read fail is gone by the time the user retries.
    state.failing = false;
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('panel content')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers a reload at page scope, where there is nothing left to remount', async () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);

    render(
      <ErrorBoundary>
        <AlwaysFails />
      </ErrorBoundary>
    );
    await userEvent.click(screen.getByRole('button'));

    expect(reload).toHaveBeenCalled();
  });
});
