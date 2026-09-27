/**
 * O a doua modificare a aceleiași înregistrări, încă netrimisă pe server, nu are
 * nevoie de un rând nou în outbox — rămâne un singur rând pending, cu ultimul
 * payload (ce se trimite), dar cu prima revizie de bază (ce compară serverul la
 * push): decizia 4 din docs/superpowers/plans/2026-09-27-sincronizare.md.
 * @param {{ baseRevision: number, payload: unknown } | undefined} pending rândul pending existent, dacă e
 * @param {{ baseRevision: number, payload: unknown }} incoming schimbarea curentă
 * @returns {{ baseRevision: number, payload: unknown }}
 */
export function coalesceOutboxChange(pending, incoming) {
  if (!pending) return { baseRevision: incoming.baseRevision, payload: incoming.payload };
  return { baseRevision: pending.baseRevision, payload: incoming.payload };
}
