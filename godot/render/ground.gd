extends Node2D
class_name Ground

## draws the world floor once, under everything (show_behind_parent), through the
## ground shader. a 1x1 white texture stretched over the field so UV spans 0..1 and
## the shader can recover world position.

var _white: ImageTexture


func _ready() -> void:
	show_behind_parent = true
	var img := Image.create(1, 1, false, Image.FORMAT_RGBA8)
	img.set_pixel(0, 0, Color.WHITE)
	_white = ImageTexture.create_from_image(img)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://render/ground.gdshader")
	mat.set_shader_parameter("world_w", Tuning.W)
	mat.set_shader_parameter("deep_x", Tuning.DEEP_X)
	material = mat


func _draw() -> void:
	draw_texture_rect(_white, Rect2(0, 0, Tuning.W, Tuning.H), false)
