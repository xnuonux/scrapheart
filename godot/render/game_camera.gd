extends Camera2D
class_name GameCamera

## the web build's camera, ported: framerate-independent lerp toward the player plus
## trauma-based shake ... squared and decaying, never additive.

var shake := 0.0
var target := Vector2.ZERO


func add_trauma(a: float) -> void:
	shake = minf(1.0, shake + a)


func _physics_process(delta: float) -> void:
	# lerp framerate-independently: k = 1 - 0.0015^dt, same constant as the web build
	var k := 1.0 - pow(0.0015, delta)
	position += (target - position) * k
	shake = maxf(0.0, shake - delta * 1.8)
	var s := shake * shake
	offset = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * 16.0 * s
