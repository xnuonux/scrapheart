extends Camera2D
class_name GameCamera

## the web build's camera, ported: framerate-independent lerp toward the player plus
## trauma-based shake ... squared and decaying, never additive.

var shake := 0.0
var target := Vector2.ZERO
## lookahead: lead the player's movement so you see where you are GOING.
## ⚠ eased, not snapped ... the camera leans into a run and settles when you stop.
var _look := Vector2.ZERO


func add_trauma(a: float) -> void:
	shake = minf(1.0, shake + a)


func _physics_process(delta: float) -> void:
	var vel := target - position
	if vel.length() > 6.0:
		_look = _look.lerp(vel.normalized() * 46.0, 1.0 - pow(0.02, delta))
	else:
		_look = _look.lerp(Vector2.ZERO, 1.0 - pow(0.05, delta))
	# lerp framerate-independently: k = 1 - 0.0015^dt, same constant as the web build
	var k := 1.0 - pow(0.0015, delta)
	position += ((target + _look) - position) * k
	shake = maxf(0.0, shake - delta * 1.8)
	var s := shake * shake
	offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * 16.0 * s
