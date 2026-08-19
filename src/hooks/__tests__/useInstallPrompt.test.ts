import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useInstallPrompt from '../useInstallPrompt';

const dispatchBeforeInstallPrompt = () => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  return event;
};

describe('useInstallPrompt', () => {
  it('starts uninstallable until the browser fires beforeinstallprompt', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it('becomes installable after beforeinstallprompt and prompts on demand', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let event: ReturnType<typeof dispatchBeforeInstallPrompt>;

    act(() => {
      event = dispatchBeforeInstallPrompt();
    });

    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(event!.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('hides the button once appinstalled fires', () => {
    const { result } = renderHook(() => useInstallPrompt());

    act(() => {
      dispatchBeforeInstallPrompt();
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.canInstall).toBe(false);
  });
});
