import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { PlaytestCard } from '../../types/Playtest';
import { LibraryPlacement, PlaytestZone } from '../../types/enums';
import { applyZoneTransform, insertIntoZone, OpeningDeal } from '../../utils/playtestBoard';

export function usePlaytestZones() {
  const [library, setLibrary] = useState<PlaytestCard[]>([]);
  const [hand, setHand] = useState<PlaytestCard[]>([]);
  const [battlefield, setBattlefield] = useState<PlaytestCard[]>([]);
  const [graveyard, setGraveyard] = useState<PlaytestCard[]>([]);
  const [exile, setExile] = useState<PlaytestCard[]>([]);

  // Single source of truth for moving one card between zones. Every named handler
  // elsewhere is a thin wrapper that adds its specific log message.
  const moveCard = useCallback(
    (
      playtestId: string,
      from: PlaytestZone,
      to: PlaytestZone,
      placement: LibraryPlacement = 'top'
    ): PlaytestCard | undefined => {
      const cardsByZone: Record<PlaytestZone, PlaytestCard[]> = {
        [PlaytestZone.LIBRARY]: library,
        [PlaytestZone.HAND]: hand,
        [PlaytestZone.BATTLEFIELD]: battlefield,
        [PlaytestZone.GRAVEYARD]: graveyard,
        [PlaytestZone.EXILE]: exile
      };
      const setters: Record<PlaytestZone, Dispatch<SetStateAction<PlaytestCard[]>>> = {
        [PlaytestZone.LIBRARY]: setLibrary,
        [PlaytestZone.HAND]: setHand,
        [PlaytestZone.BATTLEFIELD]: setBattlefield,
        [PlaytestZone.GRAVEYARD]: setGraveyard,
        [PlaytestZone.EXILE]: setExile
      };

      const found = cardsByZone[from].find((item) => item.playtestId === playtestId);
      if (!found) return undefined;

      const entering = applyZoneTransform(found, to);

      if (from !== to) {
        setters[from]((previousZone) => previousZone.filter((item) => item.playtestId !== playtestId));
      }
      setters[to]((previousZone) => insertIntoZone(previousZone, entering, to, placement));

      return found;
    },
    [library, hand, battlefield, graveyard, exile]
  );

  const resetZones = useCallback((deal: OpeningDeal) => {
    setHand(deal.hand);
    setLibrary(deal.library);
    setBattlefield([]);
    setGraveyard([]);
    setExile([]);
  }, []);

  return {
    library,
    setLibrary,
    hand,
    setHand,
    battlefield,
    setBattlefield,
    graveyard,
    setGraveyard,
    exile,
    setExile,
    moveCard,
    resetZones
  };
}

export type PlaytestZones = ReturnType<typeof usePlaytestZones>;
