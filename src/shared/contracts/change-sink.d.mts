/**
 * Port implementat de sync (server/outbox-recording-repository.mjs) și injectat de
 * composition root în `createRevisionTransaction` și în modulele cu propriul depozit
 * (prezența, șabloanele SMS) — vezi docs/superpowers/plans/2026-09-27-sincronizare.md,
 * decizia 4. Pe o instalare neconfigurată pentru sincronizare, implementarea nu scrie
 * nimic (isEnabled() === false).
 */
export interface ChangeSink {
  record(kind: string, id: string, payload: unknown | null): void;
}
