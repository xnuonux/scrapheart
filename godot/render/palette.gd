extends RefCounted
class_name Palette

## IND-34m: cold, desaturated, grey-blue. warm light is the EXCEPTION and it always
## means something. one palette, written down, never deviated from.
##
## ⚠ this is a straight port of ../src/render/palette.ts. if a colour changes there,
## it changes here, and nowhere else in the godot tree may a hex literal appear.

# the world: cold, dry, dead
const VOID := Color("#05070a")
const GROUND0 := Color("#0d1218")
const GROUND1 := Color("#131a22")
const GROUND2 := Color("#1a232d")
const STRUCTURE := Color("#232e3a")
const EDGE := Color("#2f3d4c")
const DUST := Color("#3a4757")

# the living: warm, and rare
const PLAYER := Color("#e8e2d6")
const PLAYER_HI := Color("#ffffff")

# machines: colder than the ground, so they read as objects and not as terrain
const MACHINE := Color("#4a5a6e")
const MACHINE_HI := Color("#6b7f97")
const STOPPED := Color("#2b3642")   ## the ones that gave up. on, but doing nothing

# the only saturated colour in the game, used ONLY for harm
const HARM := Color("#c9414f")
const HARM_DIM := Color("#7a2530")

# warm light: the exception, always meaningful
const LAMP := Color("#f0c98a")
const GLOW := Color("#ffd9a0")      ## a fragment that has not fully stopped
const SALVAGE := Color("#c9a84c")

# the companion has its own colour so it is never confused with anything else
const COMP := Color("#8fb8ff")
const COMP_DIM := Color("#3f5a80")


## a palette colour at a given alpha. the port of hex(c, a).
static func at(c: Color, a: float) -> Color:
	return Color(c.r, c.g, c.b, a)
