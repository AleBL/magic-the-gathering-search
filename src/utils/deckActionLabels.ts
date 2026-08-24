type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

// Shared by the desktop toolbar and the mobile page menu so the two can never word the same
// destructive action differently.
export function deckActionLabels(t: TranslateFn, editingDeckId: string | null, editingDeckName: string) {
  const saveLabel = editingDeckId
    ? editingDeckName
      ? t('deck.saveDeckNamed', { name: editingDeckName })
      : t('deck.saveChanges')
    : t('deck.saveDeck');
  const clearLabel =
    editingDeckId && editingDeckName
      ? t('deck.clearDeckNamed', { name: editingDeckName })
      : t('deck.clearTemporaryDeck');
  return { saveLabel, clearLabel };
}
