extends Node2D

## THE FIELD ... the renderer's proving ground, and the scene the real game grows in.
##
## everything main.tscn proves about the MIND stays there; this scene proves the LOOK:
## the ported palette, the procedural silhouette language, the glow discipline, the
## camera, the vignette, the world-edge fade. one seeded field, every sprite the game
## has, drawn by the same code the shipped renderer will use.
##
##   godot --path godot res://scenes/field.tscn                  drive it: WASD
##   godot --path godot res://scenes/field.tscn -- --shots       capture + quit
##
## ⚠ IND-34o's three registers (far painterly / mid pixel / near silhouette) layer on
## TOP of this. this scene is the mid register done faithfully first ... the P0 look is
## the proven baseline, and the haze that will marry the layers already lives here as
## the vignette pass.

const WORLD_W := 1600.0
const WORLD_H := 1200.0

var wrecks: Array = []          # {pos, s, seed, on}
var interest: Array = []        # {pos, kind}
var threats: Array = []         # {pos, kind, s, seed, wind}
var player_pos := Vector2(360.0, 620.0)
var player_retreating := false
var companion_pos := Vector2(378.0, 646.0)
var handler_bob := 0.0
var anchor := Vector2(300.0, 600.0)

var _cam: GameCamera
var _vignette: ColorRect

var _shots := false
var _frame := 0
var _script_steps: Array = []


func _ready() -> void:
	_cam = $Camera
	_vignette = $Haze/Vignette
	_generate(20260808)
	_cam.position = player_pos
	_cam.target = player_pos

	_shots = OS.get_cmdline_user_args().has("--shots")
	if _shots:
		_script_steps = [
			[30, Vector2.ZERO, "field-01-anchor"],
			[110, Vector2.RIGHT, "field-02-east"],
			[70, Vector2(1, 0.4).normalized(), "field-03-deeper"],
		]


## the same LCG as the sprites, so the field itself is a seed and nothing is stored.
func _generate(seed_v: int) -> void:
	var r := Sprites.Rng.new(seed_v)
	# the field of stopped machines: sparser near the anchor, denser east
	for i in 34:
		var x := 140.0 + r.next() * (WORLD_W - 280.0)
		var y := 120.0 + r.next() * (WORLD_H - 240.0)
		var d := Tuning.depth_at(x)
		if r.next() > 0.35 + d * 0.5:
			continue
		wrecks.append({
			"pos": Vector2(x, y),
			"s": 14.0 + r.next() * 26.0,
			"seed": int(r.next() * 100000.0) + 7,
			"on": false,
		})
	# the ones that gave up: individual, never in groups (IND-34l)
	var stopped_at := [Vector2(520, 300), Vector2(980, 860), Vector2(1240, 420)]
	for p in stopped_at:
		wrecks.append({"pos": p, "s": 26.0, "seed": int(p.x * 31.0 + p.y), "on": true})
	# things worth nothing (IND-34m): a shape and a light
	interest = [
		{"pos": Vector2(560, 700), "kind": "lamp"},
		{"pos": Vector2(760, 380), "kind": "arrangement"},
		{"pos": Vector2(1050, 640), "kind": "lean"},
	]
	# one of each silhouette, so the register reads side by side
	threats = [
		{"pos": Vector2(820, 560), "kind": "runner", "s": 11.0, "seed": 4211, "wind": 0.0},
		{"pos": Vector2(1150, 760), "kind": "caster", "s": 12.0, "seed": 9377, "wind": 0.55},
		{"pos": Vector2(1380, 560), "kind": "warden", "s": 24.0, "seed": 0, "wind": 0.0},
	]


func _physics_process(delta: float) -> void:
	var mv := Vector2(
		Input.get_axis("move_left", "move_right"),
		Input.get_axis("move_up", "move_down")
	)
	if _shots:
		mv = _drive_script()
	if mv.length() > 1.0:
		mv = mv.normalized()
	player_pos += mv * 2.5 * 60.0 * delta
	player_pos = player_pos.clamp(Vector2(20, 20), Vector2(WORLD_W - 20.0, WORLD_H - 20.0))

	# the companion trails at heel height; the real actor arrives with the game port
	var to := player_pos + Vector2(18.0, 26.0) - companion_pos
	if to.length() > 4.0:
		companion_pos += to.normalized() * 1.55 * 60.0 * delta

	handler_bob += delta * 6.0
	_cam.target = player_pos

	# the vignette thickens as if walking into weather, so the pass is visibly live
	var dust := clampf((player_pos.x - 900.0) / 700.0, 0.0, 0.55)
	(_vignette.material as ShaderMaterial).set_shader_parameter("dust", dust)

	queue_redraw()


func _draw() -> void:
	# ground: flat bands, no texture. cold and dry.
	draw_rect(Rect2(0, 0, WORLD_W, WORLD_H), Palette.GROUND0)
	for gx in range(0, int(WORLD_W), 160):
		for gy in range(0, int(WORLD_H), 160):
			if ((gx / 160) + (gy / 160)) % 2 == 0:
				draw_rect(Rect2(gx, gy, 160, 160), Palette.at(Palette.GROUND1, 0.5))
	# a faint grid: structure, not decoration. it makes distance readable.
	for gx in range(0, int(WORLD_W) + 1, 80):
		draw_line(Vector2(gx, 0), Vector2(gx, WORLD_H), Palette.at(Palette.STRUCTURE, 0.30), 1.0)
	for gy in range(0, int(WORLD_H) + 1, 80):
		draw_line(Vector2(0, gy), Vector2(WORLD_W, gy), Palette.at(Palette.STRUCTURE, 0.30), 1.0)

	for w in wrecks:
		Sprites.wreck(self, w.pos, w.s, w.seed, w.on)

	var t := Time.get_ticks_msec() / 1000.0
	for i in interest:
		var p: Vector2 = i.pos
		match i.kind:
			"lamp":
				Glows.draw(self, Palette.LAMP, p, 90.0, 0.22)
				draw_rect(Rect2(p.x - 1.0, p.y - 6.0, 2.0, 6.0), Palette.at(Palette.LAMP, 0.85))
			"arrangement":
				draw_rect(Rect2(p.x - 10.0, p.y - 3.0, 8.0, 6.0), Palette.at(Palette.EDGE, 0.9))
				draw_rect(Rect2(p.x + 3.0, p.y - 5.0, 7.0, 9.0), Palette.at(Palette.EDGE, 0.9))
				draw_rect(Rect2(p.x - 14.0, p.y + 6.0, 28.0, 2.0), Palette.at(Palette.EDGE, 0.9))
			_:
				var a := 0.55 + sin(t + p.x) * 0.08
				draw_polyline(PackedVector2Array([p + Vector2(-26, 10), p + Vector2(0, -14), p + Vector2(26, 10)]),
					Palette.at(Palette.EDGE, a), 2.0)

	# THE ANCHOR: warm, so it reads as the one safe thing in a cold field
	var breathe := 0.5 + sin(t * 0.9) * 0.12
	Glows.draw(self, Palette.LAMP, anchor, 70.0, 0.14 * breathe)
	draw_arc(anchor, 26.0, 0.0, TAU, 32, Palette.at(Palette.LAMP, 0.34), 1.0)
	for i in 4:
		var th := i * PI / 2.0 + PI / 4.0
		draw_rect(Rect2(anchor.x + cos(th) * 26.0 - 1.0, anchor.y + sin(th) * 26.0 - 1.0, 2.0, 2.0),
			Palette.at(Palette.LAMP, 0.7))

	for th in threats:
		match th.kind:
			"warden":
				Sprites.warden(self, th.pos, th.s, th.wind)
			"caster":
				Sprites.caster(self, th.pos, th.s, th.seed, th.wind)
			_:
				Sprites.machine(self, th.pos, th.s, th.seed, th.wind)

	Sprites.handler(self, anchor + Vector2(46.0, 10.0), handler_bob)
	Sprites.companion(self, companion_pos, 2, 0.4, 0.0, 1, false, 0.0, false)
	Sprites.player(self, player_pos, false, player_retreating)

	# ⚠ the ground ENDS rather than being CUT: dust closing in, not a level running out.
	_edge_fade()


## the world-edge fade, as four gradient quads. per-vertex colour does the falloff on
## the GPU ... no textures, no per-frame gradient construction.
func _edge_fade() -> void:
	const FADE := 190.0
	var clear := Palette.at(Palette.VOID, 0.0)
	var solid := Palette.at(Palette.VOID, 0.98)
	# east
	_grad_quad(Vector2(WORLD_W - FADE, -400), Vector2(WORLD_W + 400, WORLD_H + 400), clear, solid, true)
	# west
	_grad_quad(Vector2(-400, -400), Vector2(FADE, WORLD_H + 400), solid, clear, true)
	# south
	_grad_quad(Vector2(-400, WORLD_H - FADE), Vector2(WORLD_W + 400, WORLD_H + 400), clear, solid, false)
	# north
	_grad_quad(Vector2(-400, -400), Vector2(WORLD_W + 400, FADE), solid, clear, false)


func _grad_quad(a: Vector2, b: Vector2, from_c: Color, to_c: Color, horizontal: bool) -> void:
	var pts := PackedVector2Array([a, Vector2(b.x, a.y), b, Vector2(a.x, b.y)])
	var cols: PackedColorArray
	if horizontal:
		cols = PackedColorArray([from_c, to_c, to_c, from_c])
	else:
		cols = PackedColorArray([from_c, from_c, to_c, to_c])
	draw_polygon(pts, cols)


func _drive_script() -> Vector2:
	if _script_steps.is_empty():
		get_tree().quit(0)
		return Vector2.ZERO
	var step: Array = _script_steps[0]
	_frame += 1
	if _frame >= int(step[0]):
		_frame = 0
		var label: String = step[2]
		_script_steps.pop_front()
		# ⚠ fire the capture as a SEPARATE coroutine (the await-inside-driver trap
		# turned mv into a signal object once already; see main.gd)
		_capture(label)
	return step[1]


func _capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var dir := "user://shots"
	DirAccess.make_dir_recursive_absolute(dir)
	var path := "%s/%s.png" % [dir, label]
	img.save_png(path)
	print("[shot] %s -> %s" % [label, ProjectSettings.globalize_path(path)])
