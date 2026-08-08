extends RefCounted
class_name Fragments

## IND-34a: a fragment is one small running thing recovered from a dead machine.
## FUNCTION (what it can do) · DISPOSITION (how it decides) · MEMORY · VOICE.
## P0 ships FUNCTION + DISPOSITION only. ported from src/game/fragments.ts.
##
## ⚠ provenance is decorative and must STAY decorative (IND-34g).


class Frag:
	var id: String
	var name: String
	var provenance: String
	var loyalty := 0.0
	var caution := 0.0
	var aggression := 0.0
	var curiosity := 0.0
	var grants: Array = []
	## IND-34i: lived-in fragments glow and resist degradation. 0 = wild, 1 = long-carried.
	var worn := 0.0
	## IND-34a: pulling a fragment out degrades it. 0 = fresh, 1 = worn to nothing.
	var degradation := 0.0
	## shaped sockets: "" fits anywhere, "aux" fits ONLY an aux slot
	var shape := ""


const CATALOGUE := {
	# the first ones. found in The Halt, teaching by being obvious.
	"gait":     { "name": "GAIT REGULATOR",  "provenance": "transit unit, THE HALT" },
	"attend":   { "name": "ATTENDANCE",      "provenance": "transit unit, THE HALT", "loyalty": 0.30 },
	# FUNCTION
	"repair":   { "name": "FIELD REPAIR",    "provenance": "maintenance unit, THE HALT", "grants": ["repair"], "loyalty": 0.10 },
	"salvage":  { "name": "RECOVERY ARM",    "provenance": "yard hauler, THE DEPOT", "grants": ["salvage"], "curiosity": 0.15 },
	"mark":     { "name": "SURVEY OPTIC",    "provenance": "survey unit, THE FIELDS", "grants": ["mark"], "curiosity": 0.20 },
	"brace":    { "name": "IMPACT BRACE",    "provenance": "press operator, THE WORKS", "grants": ["interpose"], "caution": -0.10, "shape": "aux" },
	# DISPOSITION. IND-34j: no rarity. the piece that makes it loyal is common as dirt.
	"ward":     { "name": "PROXIMITY WARD",  "provenance": "handler unit, unknown", "loyalty": 0.55, "caution": -0.15 },
	"prudence": { "name": "HAZARD PRUDENCE", "provenance": "safety interlock, THE WORKS", "caution": 0.55, "aggression": -0.20 },
	"pursuit":  { "name": "PURSUIT ROUTINE", "provenance": "pest unit, THE FIELDS", "aggression": 0.55, "caution": -0.20 },
	"inquiry":  { "name": "INQUIRY LOOP",    "provenance": "survey unit, THE FIELDS", "curiosity": 0.60 },
	"selfpres": { "name": "PRESERVATION",    "provenance": "warden, THE WORKS", "caution": 0.45, "loyalty": -0.30, "shape": "aux" },
	# the one from IND-34k. the handler's heart.
	"heart":    { "name": "ATTACHMENT CORE", "provenance": "handler unit, carried", "loyalty": 0.85, "caution": -0.10, "grants": ["interpose"] },
}

## the loot table the world draws from ... FRAG_POOL in the web build, exactly.
## (the heart is never rolled; it is given once. gait is never rolled either ... the
## chassis install is the only one.)
const ROLLABLE := ["attend", "repair", "salvage", "ward", "prudence", "pursuit",
	"inquiry", "brace", "selfpres", "mark"]


static func make(id: String, worn := 0.0) -> Frag:
	assert(CATALOGUE.has(id), "no fragment: " + id)
	var base: Dictionary = CATALOGUE[id]
	var f := Frag.new()
	f.id = id
	f.name = base["name"]
	f.provenance = base["provenance"]
	f.loyalty = base.get("loyalty", 0.0)
	f.caution = base.get("caution", 0.0)
	f.aggression = base.get("aggression", 0.0)
	f.curiosity = base.get("curiosity", 0.0)
	f.grants = base.get("grants", [])
	f.shape = base.get("shape", "")
	f.worn = worn
	f.degradation = 0.0
	return f


## IND-34a: pulling a fragment out degrades it, and one cycled three or four times is
## worn to nothing. a lived-in fragment barely degrades ... its value is not that it
## hits harder, it is that it is the one you can afford to experiment with.
static func degrade_on_removal(f: Frag) -> void:
	f.degradation = Tuning.degrade(f.degradation, f.worn)
