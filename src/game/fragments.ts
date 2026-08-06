// IND-34a: a fragment is one small running thing recovered from a dead machine.
// FUNCTION (what it can do) · DISPOSITION (how it decides) · MEMORY (what it knows)
// · VOICE (how it speaks). Most are more than one at once.
//
// P0 ships FUNCTION + DISPOSITION only. Memory and voice are P1.

export type Kind = 'function' | 'disposition' | 'memory' | 'voice'

export interface Fragment {
  id: string
  name: string
  kinds: Kind[]
  /** where it was found. IND-34g: provenance is decorative and must stay decorative. */
  provenance: string
  /** disposition deltas, applied to the companion's utility weights */
  loyalty?: number
  caution?: number
  aggression?: number
  curiosity?: number
  /** capabilities this fragment unlocks */
  grants?: ('repair' | 'salvage' | 'mark' | 'interpose')[]
  /** IND-34i: lived-in fragments glow and resist degradation. 0 = wild, 1 = long-carried. */
  worn: number
  /** IND-34a: pulling a fragment out degrades it. 0 = fresh, 1 = worn to nothing. */
  degradation: number
  /** shaped sockets: null fits anywhere */
  shape: null | 'aux'
}

export const CATALOGUE: Omit<Fragment, 'worn' | 'degradation'>[] = [
  // ── the first ones. found in The Halt, teaching by being obvious. ──
  { id: 'gait',    name: 'GAIT REGULATOR',  kinds: ['function'], provenance: 'transit unit, THE HALT',
    grants: [], shape: null },
  { id: 'attend',  name: 'ATTENDANCE',      kinds: ['disposition'], provenance: 'transit unit, THE HALT',
    loyalty: 0.30, shape: null },

  // ── FUNCTION ──
  { id: 'repair',  name: 'FIELD REPAIR',    kinds: ['function'], provenance: 'maintenance unit, THE HALT',
    grants: ['repair'], loyalty: 0.10, shape: null },
  { id: 'salvage', name: 'RECOVERY ARM',    kinds: ['function'], provenance: 'yard hauler, THE DEPOT',
    grants: ['salvage'], curiosity: 0.15, shape: null },
  { id: 'mark',    name: 'SURVEY OPTIC',    kinds: ['function','memory'], provenance: 'survey unit, THE FIELDS',
    grants: ['mark'], curiosity: 0.20, shape: null },
  { id: 'brace',   name: 'IMPACT BRACE',    kinds: ['function'], provenance: 'press operator, THE WORKS',
    grants: ['interpose'], caution: -0.10, shape: 'aux' },

  // ── DISPOSITION. IND-34j: these have no rarity. the piece that makes it loyal
  //    is as common as dirt, and the design says that loudly. ──
  { id: 'ward',    name: 'PROXIMITY WARD',  kinds: ['disposition'], provenance: 'handler unit, unknown',
    loyalty: 0.55, caution: -0.15, shape: null },
  { id: 'prudence',name: 'HAZARD PRUDENCE', kinds: ['disposition'], provenance: 'safety interlock, THE WORKS',
    caution: 0.55, aggression: -0.20, shape: null },
  { id: 'pursuit', name: 'PURSUIT ROUTINE', kinds: ['disposition'], provenance: 'pest unit, THE FIELDS',
    aggression: 0.55, caution: -0.20, shape: null },
  { id: 'inquiry', name: 'INQUIRY LOOP',    kinds: ['disposition'], provenance: 'survey unit, THE FIELDS',
    curiosity: 0.60, shape: null },
  { id: 'selfpres',name: 'PRESERVATION',    kinds: ['disposition'], provenance: 'warden, THE WORKS',
    caution: 0.45, loyalty: -0.30, shape: 'aux' },

  // ── the one from IND-34k. the handler's heart. ──
  { id: 'heart',   name: 'ATTACHMENT CORE', kinds: ['disposition'], provenance: 'handler unit, carried',
    loyalty: 0.85, caution: -0.10, grants: ['interpose'], shape: null },
]

export function makeFragment(id: string, worn = 0): Fragment {
  const base = CATALOGUE.find(f => f.id === id)
  if (!base) throw new Error(`no fragment: ${id}`)
  return { ...base, worn, degradation: 0 }
}

/**
 * IND-34a: pulling a fragment out degrades it, and one cycled three or four times
 * is worn to nothing. IND-34i: a lived-in fragment barely degrades ... its value is
 * not that it hits harder, it is that it is the one you can afford to experiment with.
 */
export function degradeOnRemoval(f: Fragment): Fragment {
  const resist = 1 - f.worn * 0.8
  return { ...f, degradation: Math.min(1, f.degradation + 0.28 * resist) }
}

/** effective strength of a disposition delta after wear */
export const effective = (f: Fragment, v: number | undefined) =>
  (v ?? 0) * (1 - f.degradation)
