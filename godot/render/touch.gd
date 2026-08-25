extends Control
class_name TouchLayer

## THE TOUCH LAYER (IND-34o §1: this ships to the phone stores). the web build's exact
## scheme, ported from core/input.ts: floating stick on the LEFT half, fire+aim on the
## RIGHT half, pointercancel handled or inputs stick on. drawn in the HUD layer so the
## player can see their own thumbs' machinery; pass-through except where it acts.

var stick_active := false
var stick_id := -1
var stick_origin := Vector2.ZERO
var stick_vec := Vector2.ZERO          ## -1..1, the movement axis
var fire_id := -1
var fire_pos := Vector2.ZERO
var firing := false
var aim_world := Vector2.ZERO          ## set by the scene's camera transform

var game = null                        ## game.gd, duck-typed, for screen->world


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process_input(true)


func _input(event: InputEvent) -> void:
	if game == null:
		return
	# ⚠ touch only. the mouse keeps its own path (click = fire at cursor); a mouse
	# press must never spawn a phantom stick.
	if event is InputEventScreenTouch:
		if event.pressed:
			if event.position.x < size.x / 2.0 and stick_id == -1:
				stick_id = event.index
				stick_active = true
				stick_origin = event.position
				stick_vec = Vector2.ZERO
			elif fire_id == -1:
				fire_id = event.index
				firing = true
				fire_pos = event.position
				aim_world = game.get_global_mouse_position() if false else _to_world(event.position)
		else:
			if event.index == stick_id:
				stick_id = -1
				stick_active = false
				stick_vec = Vector2.ZERO
			elif event.index == fire_id:
				fire_id = -1
				firing = false
	elif event is InputEventScreenDrag:
		if event.index == stick_id:
			var d: Vector2 = event.position - stick_origin
			var m: float = d.length()
			var maxr := 56.0
			stick_vec = (d / maxr) if m <= maxr else d.normalized()
			queue_redraw()
		elif event.index == fire_id:
			fire_pos = event.position
			aim_world = _to_world(event.position)


func _to_world(screen: Vector2) -> Vector2:
	var cam: Camera2D = game.cam
	return cam.get_canvas_transform().affine_inverse() * screen


func _draw() -> void:
	if not stick_active:
		return
	# the stick, drawn where the thumb landed. a fixed stick means the thumb must find
	# IT ... the floating one means the stick finds the thumb.
	draw_arc(stick_origin, 56.0, 0.0, TAU, 40, Palette.at(Palette.COMP_DIM, 0.35), 1.5)
	var knob := stick_origin + stick_vec * 40.0
	draw_circle(knob, 16.0, Palette.at(Palette.COMP, 0.28))
	draw_arc(knob, 16.0, 0.0, TAU, 24, Palette.at(Palette.COMP, 0.5), 1.5)
