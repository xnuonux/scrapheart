extends RefCounted
class_name Sprites

## procedural machine sprites ... the port of ../src/render/sprites.ts.
##
## the world is machines ASSEMBLED FROM PARTS, so sprites assembled from parts is
## honest. every machine draws from a seed: the same wreck looks the same forever
## without storing a single pixel.
##
## ⚠ IND-34o rules this layer: the companion stays PROCEDURAL forever ("my machine
## moves differently to yours" is the emotional point). the handler, warden and world
## get hand-crafted fluidity LATER, layered on top of these silhouettes ... the
## silhouette language itself is canon and survives that pass.

## the web build's LCG, ported exactly, so a seed produces the same machine here.
class Rng:
	var s: int
	func _init(seed_v: int) -> void:
		s = seed_v | 1
	func next() -> float:
		s = (s * 16807) % 2147483647
		if s < 0:
			s += 2147483647
		return float(s) / 2147483647.0


static func _now() -> float:
	return Time.get_ticks_msec() / 1000.0


## a rotated bar around origin ... the limb primitive everything is built from.
static func _limb(ci: CanvasItem, origin: Vector2, angle: float, length: float, thickness: float, colour: Color) -> void:
	ci.draw_set_transform(origin, angle, Vector2.ONE)
	ci.draw_rect(Rect2(0, -thickness / 2.0, length, thickness), colour)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


## a stopped machine: silhouette first, because at phone size nobody sees detail.
static func wreck(ci: CanvasItem, pos: Vector2, s: float, seed_v: int, on := false) -> void:
	var r := Rng.new(seed_v)
	var body := Palette.STOPPED if on else Palette.GROUND2.lerp(Palette.MACHINE, 0.35)

	var w := s * (0.7 + r.next() * 0.6)
	var h := s * (0.5 + r.next() * 0.7)
	ci.draw_rect(Rect2(pos.x - w / 2.0, pos.y - h / 2.0, w, h), body)

	var limbs := 2 + int(r.next() * 3.0)
	for i in limbs:
		var a := r.next() * TAU
		var len := s * (0.4 + r.next() * 0.9)
		var th := maxf(2.0, s * 0.16)
		_limb(ci, pos, a, len, th, body)

	# a highlight edge on one side, so the silhouette reads as a volume
	ci.draw_rect(Rect2(pos.x - w / 2.0, pos.y - h / 2.0, w, maxf(1.0, s * 0.12)),
		Palette.at(Palette.MACHINE_HI, 0.35 if on else 0.18))

	# IND-34l: the ones that gave up are STILL ON. that is the whole tell.
	if on:
		var pulse := 0.45 + sin(_now() / 0.9 + float(seed_v)) * 0.25
		ci.draw_rect(Rect2(pos.x - 1.0, pos.y - h / 2.0 - 3.0, 2.0, 2.0), Palette.at(Palette.LAMP, pulse))


## an active machine. same construction, colder colour, and it moves.
static func machine(ci: CanvasItem, pos: Vector2, s: float, seed_v: int, wind: float) -> void:
	var r := Rng.new(seed_v)
	var lean := wind * 3.0

	var w := s * 1.4
	var h := s * 1.2
	ci.draw_rect(Rect2(pos.x - w / 2.0 + lean, pos.y - h / 2.0, w, h), Palette.MACHINE)

	for i in 3:
		var a := (float(i) / 3.0) * TAU + r.next() * 0.6
		var len := s * (0.8 + r.next() * 0.5)
		_limb(ci, pos, a, len, 3.0, Palette.MACHINE)

	ci.draw_rect(Rect2(pos.x - w / 2.0 + lean, pos.y - h / 2.0, w, 2.0), Palette.MACHINE_HI)

	# the telegraph. they were built to be safe around humans and that safety system
	# is one of the few things still working (IND-34j).
	if wind > 0.0:
		ci.draw_arc(pos, 18.0 + wind * 34.0, 0.0, TAU, 32, Palette.at(Palette.HARM, minf(1.0, wind)), 2.0)


## IND-34n: the caster. taller and thinner than a runner so the silhouette alone says
## "this one does not come to you" at phone size, in a crowd, with no colour cue.
static func caster(ci: CanvasItem, pos: Vector2, s: float, seed_v: int, wind: float) -> void:
	var r := Rng.new(seed_v)
	var h := s * 2.0
	var w := s * 0.62
	ci.draw_rect(Rect2(pos.x - w / 2.0, pos.y - h * 0.62, w, h), Palette.MACHINE.lerp(Palette.VOID, 0.12))
	# a tripod, so it reads as planted rather than running
	for i in 3:
		var a := PI / 2.0 + (float(i) - 1.0) * 0.62 + r.next() * 0.1
		_limb(ci, pos + Vector2(0, h * 0.32), a, s * 0.95, 3.0, Palette.MACHINE.lerp(Palette.VOID, 0.12))
	ci.draw_rect(Rect2(pos.x - w / 2.0, pos.y - h * 0.62, w, 2.0), Palette.at(Palette.MACHINE_HI, 0.55))
	# the charge, on the emitter, because you read it from across the field
	if wind > 0.0:
		var c := 2.0 + wind * 5.0
		ci.draw_rect(Rect2(pos.x - c / 2.0, pos.y - h * 0.62 - c - 1.0, c, c), Palette.at(Palette.HARM, minf(1.0, wind)))
		ci.draw_arc(pos + Vector2(0, -h * 0.2), 14.0 + wind * 12.0, 0.0, TAU, 32,
			Palette.at(Palette.HARM, minf(0.7, wind * 0.6)), 1.0)


## IND-34k: the warden. bigger, slower, and it does not look angry. it looks like
## equipment. ⚠ the telegraph is enormous because a warden is not trying to trick you,
## it is warning you, exactly as it was built to.
static func warden(ci: CanvasItem, pos: Vector2, s: float, wind: float) -> void:
	var lean := wind * 4.0
	var body := Palette.MACHINE.lerp(Palette.VOID, 0.25)
	ci.draw_rect(Rect2(pos.x - s * 0.8 + lean, pos.y - s * 0.9, s * 1.6, s * 1.8), body)
	for i in 4:
		var a := (float(i) / 4.0) * TAU + 0.4
		_limb(ci, pos, a, s * 1.5, 6.0, body)
	ci.draw_rect(Rect2(pos.x - s * 0.8 + lean, pos.y - s * 0.9, s * 1.6, 3.0), Palette.at(Palette.MACHINE_HI, 0.5))
	# the working light. amber, because it is a maintenance unit doing maintenance.
	var pulse := 0.5 + sin(_now() / 0.26) * 0.35
	ci.draw_rect(Rect2(pos.x - 3.0, pos.y - s * 0.9 - 6.0, 6.0, 4.0), Palette.at(Palette.LAMP, pulse))
	if wind > 0.0:
		ci.draw_arc(pos, 40.0 + wind * 58.0, 0.0, TAU, 48, Palette.at(Palette.HARM, minf(0.95, wind * 0.75)), 3.0)


## IND-34k: the handler. somebody else's design, so it does NOT share the companion's
## construction language ... no sockets to read, no parts to count. warm rather than
## cold, because it is the only friendly thing in the game the player did not build.
static func handler(ci: CanvasItem, pos: Vector2, bob: float) -> void:
	var b := sin(bob) * 1.2
	var body := Palette.LAMP.lerp(Palette.MACHINE, 0.55)
	ci.draw_rect(Rect2(pos.x - 6.0, pos.y - 3.0 + b, 12.0, 6.0), body)   # body, long and low
	ci.draw_rect(Rect2(pos.x + 4.0, pos.y - 6.0 + b, 5.0, 5.0), body)   # head, forward
	ci.draw_rect(Rect2(pos.x - 5.0, pos.y + 3.0, 2.0, 3.0), Palette.at(Palette.STRUCTURE, 0.9))
	ci.draw_rect(Rect2(pos.x + 3.0, pos.y + 3.0, 2.0, 3.0), Palette.at(Palette.STRUCTURE, 0.9))
	ci.draw_rect(Rect2(pos.x + 6.0, pos.y - 5.0 + b, 2.0, 2.0), Palette.at(Palette.LAMP, 0.95))


## the companion. assembled, so its silhouette grows with what is installed.
static func companion(ci: CanvasItem, pos: Vector2, parts: int, exposure: float, hurt: float,
		empty := 0, mending := false, facing := 0.0, marking := false) -> void:
	if exposure > 0.0:
		ci.draw_arc(pos, 11.0 + exposure * 7.0, 0.0, TAU, 32, Palette.at(Palette.COMP, 0.22 * exposure), 1.0)
	if mending:
		var b := 0.35 + sin(_now() / 0.18) * 0.25
		ci.draw_arc(pos, 13.0, 0.0, TAU, 32, Palette.at(Palette.LAMP, b), 1.0)
	# 🚨 the gate asks whether players REACT when it is badly hurt, so being hurt has to
	# be visible on the thing itself. it falters rather than flashing: the light stutters
	# and the body dims, a machine in trouble instead of a health bar in disguise.
	if hurt > Tuning.HURT_THRESHOLD:
		var stutter := 1.0 if sin(_now() / 0.09) > 0.2 else 0.45
		ci.draw_rect(Rect2(pos.x - 8.0, pos.y - 8.0, 16.0, 16.0), Palette.at(Palette.HARM, 0.32 * hurt * stutter))
	# ⚠ dim toward the cold structure colour, NOT toward harm ... comp blue into harm red
	# made a PURPLE machine once, and there is no purple anywhere in this palette.
	# ⚠ the SAME threshold as the log line and the halo. three thresholds for one idea is
	# how a game says "it is hurt" about a machine that still looks fine.
	var body := Palette.COMP.lerp(Palette.STRUCTURE, minf(0.7, hurt * 0.7)) if hurt > Tuning.HURT_THRESHOLD else Palette.COMP
	ci.draw_rect(Rect2(pos.x - 5.0, pos.y - 5.0, 10.0, 10.0), body)
	# one small mark per installed fragment. you can read what it is made of.
	for i in parts:
		ci.draw_rect(Rect2(pos.x - 5.0 + i * 4.0, pos.y + 6.0, 3.0, 2.0), Palette.at(Palette.COMP_DIM, 0.9))
	# ⚠ IND-34a: one hollow mark per EMPTY socket. the scar is on the body, not in a menu.
	for i in empty:
		ci.draw_rect(Rect2(pos.x - 4.5 + (parts + i) * 4.0, pos.y + 6.5, 2.0, 1.0),
			Palette.at(Palette.COMP_DIM, 0.5), false, 1.0)
	# 🚨 the light it has instead of a face, on the side the machine is LOOKING. no icon,
	# no arrow, no dialogue ... the player learns to read a two-pixel light.
	var lp := pos + Vector2(cos(facing), sin(facing)) * 3.4
	ci.draw_rect(Rect2(lp.x - 1.0, lp.y - 1.0, 2.0, 2.0), Palette.at(Palette.GLOW, 0.95 if marking else 0.8))
	# ⚠ when it has noticed something you have not, the light steadies and reaches a
	# little further. that is the ONLY tell, and it is deliberately easy to miss.
	if marking:
		var mp := pos + Vector2(cos(facing), sin(facing)) * 6.0
		ci.draw_rect(Rect2(mp.x - 1.0, mp.y - 1.0, 2.0, 2.0), Palette.at(Palette.GLOW, 0.22))


static func player(ci: CanvasItem, pos: Vector2, hurt: bool, retreating: bool) -> void:
	ci.draw_circle(pos, 7.0, Palette.PLAYER_HI if hurt else Palette.PLAYER)
	if retreating:
		ci.draw_arc(pos, 13.0, 0.0, TAU, 32, Palette.at(Palette.LAMP, 0.5), 1.0)
