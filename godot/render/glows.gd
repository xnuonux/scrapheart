extends RefCounted
class_name Glows

## 🚨 EVERY radial glow in this game, rasterised once and blitted after.
##
## the web build learned this the expensive way: 16 createRadialGradient calls per frame
## in CLEAR AIR, and gradients were the most expensive call in the API. the same law
## holds here ... a GradientTexture2D is built ONCE per (colour, radius, shape) and the
## draw is a texture blit.
##
## ⚠ keyed on colour + radius quantised to 8px, so the key set stays tiny and bounded.
## a cache with an unbounded key set is a memory leak wearing an optimisation's clothes.

static var _cache: Dictionary = {}


static func sprite(colour: Color, radius: float, inner := 0.0, mid_at := -1.0, mid_alpha := 0.0) -> GradientTexture2D:
	var r := maxf(8.0, roundf(radius / 8.0) * 8.0)
	var key := "%s|%d|%.2f|%.2f|%.2f" % [colour.to_html(false), int(r), inner, mid_at, mid_alpha]
	if _cache.has(key):
		return _cache[key]
	var g := Gradient.new()
	var offsets := PackedFloat32Array()
	var colours := PackedColorArray()
	offsets.push_back(0.0)
	colours.push_back(Palette.at(colour, 1.0))
	if inner > 0.0:
		# hold full alpha out to the inner stop, like the web sprite's inner radius
		offsets.push_back(inner)
		colours.push_back(Palette.at(colour, 1.0))
	if mid_at >= 0.0:
		offsets.push_back(mid_at)
		colours.push_back(Palette.at(colour, mid_alpha))
	offsets.push_back(1.0)
	colours.push_back(Palette.at(colour, 0.0))
	g.offsets = offsets
	g.colors = colours
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(0.5, 0.0)
	t.width = int(r * 2.0)
	t.height = int(r * 2.0)
	_cache[key] = t
	return t


## blit a cached glow centred at pos. alpha lives at the blit, never in the texture,
## so breathing radii and pulsing lights reuse the same handful of sprites.
static func draw(ci: CanvasItem, colour: Color, pos: Vector2, radius: float, alpha: float,
		inner := 0.0, mid_at := -1.0, mid_alpha := 0.0) -> void:
	if alpha <= 0.004 or radius <= 0.0:
		return
	var t := sprite(colour, radius, inner, mid_at, mid_alpha)
	ci.draw_texture_rect(t, Rect2(pos - Vector2(radius, radius), Vector2(radius * 2.0, radius * 2.0)),
		false, Color(1, 1, 1, alpha))
