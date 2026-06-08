/**
 * Capability-grade proposal refs.
 *
 * The ref IS the credential for `/proposal/:ref` — it must be unguessable. 22
 * chars of this 54-symbol alphabet ≈ 126 bits of entropy. Ambiguous glyphs
 * (I, O, l, 0/O collisions) are excluded so a ref survives being read aloud or
 * copied off a screen on a call. The `RS-` prefix matches the house ref style.
 */
import { customAlphabet } from "nanoid";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghijkmnpqrstuvwxyz";
const gen = customAlphabet(ALPHABET, 22);

export function newProposalRef(): string {
  return `RS-${gen()}`;
}
