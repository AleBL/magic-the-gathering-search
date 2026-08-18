import { Card } from '../types/Card';

export interface CardFaceImages {
  front: string;
  back: string;
}

export function faceImage(face: NonNullable<Card['card_faces']>[number]): string {
  return face.image_uris?.normal || face.image_uris?.large || face.image_uris?.png || '';
}

// Requiring an image on both faces is what excludes split, adventure and flip cards: they
// have two faces in the data but one physical image, and flipping them shows nothing.
export function getCardFaceImages(card: Card): CardFaceImages | null {
  const faces = card.card_faces;
  if (!faces || faces.length < 2) return null;

  const front = faceImage(faces[0]);
  const back = faceImage(faces[1]);
  if (!front || !back) return null;

  return { front, back };
}

export function isDoubleFaced(card: Card): boolean {
  return getCardFaceImages(card) !== null;
}

// Multi-face cards usually have no top-level `printed_name`, so the localized name has to be
// rebuilt from the faces ("Expansão // Explosão") or the card shows up in English.
export function localizedCardName(card: Card): string {
  if (card.printed_name) return card.printed_name;
  const faces = card.card_faces;
  if (faces && faces.length > 1) {
    const names = faces.map((face) => face.printed_name || face.name);
    if (names.every(Boolean)) return names.join(' // ');
  }
  return card.name;
}

/** Printed attributes come from the face, identity (ids, set, prices) from the physical card. */
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
    // A selected print image always shows the front of the physical card, so carrying it onto
    // the back face would show the wrong side.
    selectedPrintImageUri: faceIndex === 0 ? card.selectedPrintImageUri : undefined
  };
}
