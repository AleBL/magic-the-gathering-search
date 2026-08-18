import { useEffect, useState } from 'react';
import { DeckRelatedToken } from '../../types/Deck';
import { RelatedToken } from '../useCardRelatedTokens';

interface DeckTokenListArgs {
  cachedTokens?: DeckRelatedToken[];
  onTokensLoaded?: (tokens: RelatedToken[]) => void;
}

/**
 * The deck's token list. Every change is reported through `onTokensLoaded`, which is how the
 * list reaches the deck record: this hook never writes to the database itself.
 */
export function useDeckTokenList({ cachedTokens, onTokensLoaded }: DeckTokenListArgs) {
  const [localTokens, setLocalTokens] = useState<RelatedToken[]>([]);

  useEffect(() => {
    setLocalTokens(cachedTokens ?? []);
  }, [cachedTokens]);

  const publishTokens = (tokens: RelatedToken[]) => {
    setLocalTokens(tokens);
    onTokensLoaded?.(tokens);
  };

  const addTokens = (tokens: RelatedToken[]) => {
    publishTokens([...localTokens, ...tokens]);
  };

  const handleDeleteToken = (tokenId: string) => {
    publishTokens(localTokens.filter((token) => token.tokenCard.id !== tokenId));
  };

  return { localTokens, addTokens, handleDeleteToken, publishTokens };
}
