import { Card } from '../types/Card';

export interface CardFaceImages {
  front: string;
  back: string;
}

/** Best-available image URL for a single card face ('' when the face has none). */
export function faceImage(face: NonNullable<Card['card_faces']>[number]): string {
  return face.image_uris?.normal || face.image_uris?.large || face.image_uris?.png || '';
}

/**
 * Returns the two face image URLs for a genuinely double-faced card
 * (transform / modal double-faced), or `null` otherwise.
 *
 * Only cards whose two faces each carry their own `image_uris` qualify —
 * that excludes split, adventure and flip cards, which share a single
 * physical image and must not be flipped.
 */
export function getCardFaceImages(card: Card): CardFaceImages | null {
  const faces = card.card_faces;
  if (!faces || faces.length < 2) return null;

  const front = faceImage(faces[0]);
  const back = faceImage(faces[1]);
  if (!front || !back) return null;

  return { front, back };
}

/** Whether the card can be flipped to reveal a distinct back face. */
export function isDoubleFaced(card: Card): boolean {
  return getCardFaceImages(card) !== null;
}

/**
 * The card's display name in the printing's language. Multi-face cards (split,
 * DFC…) often lack a top-level `printed_name`, so their localized name is
 * composed from the faces' `printed_name` (e.g. "Expansão // Explosão").
 */
export function localizedCardName(card: Card): string {
  if (card.printed_name) return card.printed_name;
  const faces = card.card_faces;
  if (faces && faces.length > 1) {
    const names = faces.map((face) => face.printed_name || face.name);
    if (names.every(Boolean)) return names.join(' // ');
  }
  return card.name;
}

/**
 * Returns a Card representing exactly one face of a double-faced card:
 * name, types, cost, P/T, text and image all come from that face, while
 * ids/set/prices stay from the physical card. Used by the playtest so the
 * battlefield registers the face actually being played. Returns the card
 * unchanged when the requested face doesn't exist.
 */
export function cardWithFace(card: Card, faceIndex: number): Card {
  const face = card.card_faces?.[faceIndex];
  if (!face) return card;

  return {
    ...card,
    name: face.name,
    printed_name: face.printed_name || face.name,
    type_line: face.type_line,
    printed_type_line: face.printed_type_line,
    oracle_text: face.oracle_text,
    printed_text: face.printed_text,
    mana_cost: face.mana_cost,
    power: face.power,
    toughness: face.toughness,
    image_uris: face.image_uris ?? card.image_uris,
    // A selected print image always shows the FRONT of the physical card —
    // only keep it when the front face is the one being represented.
    selectedPrintImageUri: faceIndex === 0 ? card.selectedPrintImageUri : undefined
  };
}
