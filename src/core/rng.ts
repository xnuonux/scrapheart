// Law 7: deterministic RNG, seeded and stored. Math.random() cannot be replayed,
// debugged, or synced, and IND-34 is eventually networked.

import seedrandom from 'seedrandom'

export const rng = (seed: string) => seedrandom(seed)

/** the run seed. stored so any run can be replayed exactly. */
export let RUN_SEED = 'halt-0'
export function setRunSeed(s: string) { RUN_SEED = s }
