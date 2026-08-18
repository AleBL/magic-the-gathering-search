import { DeckFormatType } from '../types/enums';

// Format labels live under the `validation` namespace while the default namespace is
// `translations`, so a bare `t(format)` renders the raw key instead of the label. Route
// every format label through here and the prefix can never be forgotten.
export function formatLabelKey(format?: string | null): string {
  const key = (format || DeckFormatType.FREEFORM).toLowerCase();
  return `validation.${key}`;
}
