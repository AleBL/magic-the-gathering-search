import { useCallback, useState } from 'react';
import { LogEntry } from '../../types/Playtest';
import { newId } from '../../utils/id';

export type LogAction = (text: string) => void;

const nowLabel = (): string =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function usePlaytestLog() {
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);

  const logAction = useCallback<LogAction>((text) => {
    setGameLog((previousLog) => [...previousLog, { id: newId(), text, timestamp: nowLabel() }]);
  }, []);

  const resetLog = useCallback((text: string) => {
    setGameLog([{ id: 'start', text, timestamp: nowLabel() }]);
  }, []);

  return { gameLog, setGameLog, logAction, resetLog };
}
