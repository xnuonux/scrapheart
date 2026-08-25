extends Node2D
class_name Farfield

## THE FAR REGISTER (IND-34o §2). painterly, atmospheric, hand-made ... except nothing
## is hand-made, because the whole world is procedural and its skyline is too.
##
## colossal machines on the horizon: the things this place once served. they never
## animate (the register law: far plates parallax and never move) ... they sit, they
## fade, and the haze marries them to the mid layer. a handful of large plates, low
## count, big pixels ... exactly the cost strategy the doc calls load-bearing.
##
## ⚠ they are drawn BEHIND the ground node and drift at a fraction of camera speed.
## the drift is the only motion, and it is the player's own.

const FACTOR := 0.35            ## how much of the camera they follow (0 = fixed sky)
const PLATES := 5

var _cam := Vector2.ZERO
var _plates: Array = []         ## { origin, hulls: [Rect2], limbs: [...], lights: [Vector2], w }


func _ready() -> void:
	show_behind_parent = false
	# ⚠ ABOVE the world draw (z 0): the colossi stand beyond the edge fade, and they
	# are so colossal they read THROUGH it ... seen dimly through the dust, which is
	# the entire pull of walking east. the haze CanvasLayer still sits above and
	# marries them to the mid layer.
	z_index = 5
	_generate(3434001)


## a colossal machine: a hull mass, a few enormous limbs, one or two lights still lit.
## painted from a seed so the skyline is stable forever and costs nothing to store.
## ⚠ this is a TOP-DOWN field, so the far register lives BEYOND the world edges, and
## ⚠ origins are in CAMERA space: the parallax offset adds cam*(1-FACTOR), so a plate
## placed at x≈900 is on screen exactly when the player is deep (cam≈1300). walking
## east, they drift toward you at 35% of your speed ... you never reach them.
func _generate(seed_v: int) -> void:
	var r := Sprites.Rng.new(seed_v)
	var spots := [
		Vector2(880, -420), Vector2(1180, 60), Vector2(760, 1560),
		Vector2(1320, -780), Vector2(-620, -260), Vector2(-940, 620),
	]
	for i in spots.size():
		var w := 420.0 + r.next() * 520.0
		var h := 260.0 + r.next() * 340.0
		var origin: Vector2 = spots[i] + Vector2((r.next() - 0.5) * 160.0, (r.next() - 0.5) * 160.0)
		var hulls: Array = []
		# the hull: a stacked mass, wide at the base
		hulls.append(Rect2(-w / 2.0, -h, w, h))
		hulls.append(Rect2(-w * 0.34 + (r.next() - 0.5) * 60.0, -h * 1.28, w * 0.68, h * 0.42))
		# enormous limbs, at rest angles
		var limbs: Array = []
		for k in 2 + int(r.next() * 2.0):
			limbs.append({ "a": r.next() * TAU, "len": w * (0.5 + r.next() * 0.7), "th": 14.0 + r.next() * 18.0 })
		# the lights that are still on. rarely more than two.
		var lights: Array = []
		for k in (1 + int(r.next() * 2.0)):
			lights.append(Vector2((r.next() - 0.5) * w * 0.6, -h * (0.25 + r.next() * 0.55)))
		_plates.append({ "origin": origin, "hulls": hulls, "limbs": limbs, "lights": lights, "w": w })


func follow(cam_pos: Vector2) -> void:
	_cam = cam_pos
	# the plates drift at FACTOR of camera speed: origins are camera-space, so this
	# offset is what makes them approach as you travel ... and never arrive.
	position = _cam * (1.0 - FACTOR)
	queue_redraw()


func _draw() -> void:
	# ⚠ no background fill here: at z 5 this node draws OVER the world, so a fill would
	# paint out the field. only the colossi themselves, seen through the deep.
	for p in _plates:
		var o: Vector2 = p.origin
		# atmospheric perspective: the colossi are seen THROUGH the deep's dust, so
		# distance owns their alpha and the blue shift. the haze marries the rest.
		var dist: float = o.distance_to(_cam) / 1800.0
		var fade := clampf(0.62 - dist * 0.30, 0.06, 0.62)
		var body := Palette.STRUCTURE.lerp(Palette.VOID, 0.25 + dist * 0.3)
		body = body.lerp(Color(0.10, 0.14, 0.21), dist * 0.35)

		# a soft atmospheric bed behind the silhouette, so it sits IN air, not ON paper
		Glows.draw(self, Color(0.09, 0.12, 0.18), o + Vector2(0, -p.w * 0.18), p.w * 0.75, 0.5 * fade, 0.15)

		for hull in p.hulls:
			draw_rect(Rect2(o + hull.position, hull.size), Palette.at(body, fade))
		for limb in p.limbs:
			Sprites._limb(self, o, limb.a, limb.len, limb.th, Palette.at(body, fade * 0.9))

		# the lights still on up there. they do not pulse ... the far register never
		# animates. they just ARE, which is louder.
		for lp in p.lights:
			draw_rect(Rect2(o + lp, Vector2(4, 4)), Palette.at(Palette.LAMP, fade * 0.9))
			Glows.draw(self, Palette.LAMP, o + lp + Vector2(2, 2), 26.0, 0.30 * fade)
