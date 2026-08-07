extends Node2D

## The smallest thing that proves the ported MIND runs inside the engine rather than
## only inside a test. Not the game ... the game's renderer is the work still ahead.
##
## ⚠ What this must show: a companion that decides for itself, whose behaviour changes
## because of what is installed and where the threats are. If that reads, the port is
## real and the rest is drawing.

const P_VOID := Color("#05070a")
const P_GROUND := Color("#0d1218")
const P_STRUCTURE := Color("#232e3a")
const P_PLAYER := Color("#e8e2d6")
const P_COMP := Color("#8fb8ff")
const P_COMP_DIM := Color("#3f5a80")
const P_HARM := Color("#c9414f")
const P_LAMP := Color("#f0c98a")

var mind: CompanionMind
var world := {}
var player_pos := Vector2(700, 600)
var companion_pos := Vector2(710, 620)
var threats := []
var lines: Array[String] = []


class Frag:
	var name: String
	var loyalty := 0.0
	var caution := 0.0
	var aggression := 0.0
	var curiosity := 0.0
	var grants := []
	var shape = null
	var worn := 0.0
	var degradation := 0.0
	func _init(n: String, l := 0.0, c := 0.0, a := 0.0, cu := 0.0):
		name = n; loyalty = l; caution = c; aggression = a; curiosity = cu


## the shim the mind talks to. in the finished game this is the real world; here it is
## just enough surface for `decide()` to run honestly.
class Shim:
	var host
	var threats := []
	var salvage := []
	var interest := []
	var player_pos: Vector2
	var companion_pos: Vector2
	var player_hp := 100.0
	var companion_hp := 50.0
	var companion_max_hp := 50.0
	var player_retreating := false
	func _init(h): host = h
	func dust_at(_p) -> float: return 0.0
	func is_hostile(t) -> bool: return t.alive and t.kind != "stopped"
	func log_line(s: String) -> void: host.say(s)
	func companion_name() -> String: return "it"

class T:
	var pos: Vector2
	var kind := "runner"
	var alive := true
	func _init(p: Vector2): pos = p

var shim: Shim


## 🚨 THE GODOT EQUIVALENT OF THE PLAYWRIGHT PROBES.
##
## The web build is trustworthy because every claim about it has a screenshot or a number
## behind it. A port that can only be checked by a human opening the editor loses that
## immediately. `--shots` drives the scene on a script and saves frames, so "it works"
## stays a thing with evidence attached.
##
##   godot --path godot -- --shots
var _shots := false
var _frame := 0
var _script_steps := []


func _ready() -> void:
	_shots = OS.get_cmdline_user_args().has("--shots")
	if _shots:
		# each step: [frames_to_hold, input_vector, label]
		_script_steps = [
			[40, Vector2.ZERO, "01-idle"],
			[90, Vector2.RIGHT, "02-closed"],   # walk INTO it
			[90, Vector2.LEFT, "03-retreating"],# fall back ... covering should fire
		]
	mind = CompanionMind.new()
	# ATTENDANCE: the first fragment the opening puts in your hands, and the one that
	# makes it brave enough to advance while you fall back.
	mind.installed = [Frag.new("ATTENDANCE", 0.30), null, null]
	mind.recompute()
	shim = Shim.new(self)
	threats.append(T.new(Vector2(1000, 600)))
	say("it stands up.")


func say(s: String) -> void:
	lines.push_front(s)
	if lines.size() > 5:
		lines.pop_back()


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

	# ⚠ retreating is INFERRED from moving away from something close. it was assigned
	# `false` every frame and set true nowhere in the original build, which made COVERING
	# ... the entire emotional engine of this game ... score zero forever.
	var nearest = null
	var nearest_d := INF
	for t in threats:
		var d := player_pos.distance_to(t.pos)
		if d < nearest_d:
			nearest_d = d
			nearest = t
	shim.player_retreating = false
	if nearest and mv != Vector2.ZERO and nearest_d < Tuning.RETREAT_RANGE:
		# ⚠ explicit type: `nearest` is untyped (null until assigned), so `.pos` is a
		# Variant and GDScript cannot infer through it.
		var away: Vector2 = (player_pos - nearest.pos).normalized()
		shim.player_retreating = mv.dot(away) > Tuning.RETREAT_DOT

	shim.threats = threats
	shim.player_pos = player_pos
	shim.companion_pos = companion_pos
	mind.decide(shim, delta)

	# act: enough to show the decision, not the finished actor
	var target := player_pos + Vector2(0, 26)
	if mind.behaviour == CompanionMind.B.COVER and nearest:
		target = nearest.pos + (player_pos - nearest.pos) * 0.3
	elif mind.behaviour == CompanionMind.B.ENGAGE and nearest:
		target = nearest.pos
	var to := target - companion_pos
	if to.length() > 4.0:
		companion_pos += to.normalized() * 1.55 * 60.0 * delta

	# the threat chases, because a static one produces a situation the game never has
	if nearest:
		nearest.pos += (player_pos - nearest.pos).normalized() * 0.7 * 60.0 * delta

	queue_redraw()


## walk the scripted steps, capturing a frame at the end of each. ⚠ the capture happens
## AFTER a redraw, or it saves the frame before the thing being tested happened.
func _drive_script() -> Vector2:
	if _script_steps.is_empty():
		get_tree().quit(0)
		return Vector2.ZERO
	var step = _script_steps[0]
	_frame += 1
	if _frame >= step[0]:
		_frame = 0
		var label: String = step[2]
		_script_steps.pop_front()
		# ⚠ fire the capture as a SEPARATE coroutine. awaiting inside this function turned
		# it into one, so `mv = _drive_script()` received a signal object instead of a
		# vector and the scene never advanced or quit.
		_capture(label)
	return step[1]


func _capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var dir := "user://shots"
	DirAccess.make_dir_recursive_absolute(dir)
	var path := "%s/gd-%s.png" % [dir, label]
	img.save_png(path)
	print("[shot] %s  behaviour=%s  retreating=%s  warm=%d" % [
		label, CompanionMind.NAMES[mind.behaviour], str(shim.player_retreating), mind.warm.size()])
	print("       -> %s" % ProjectSettings.globalize_path(path))


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(Tuning.W, Tuning.H)), P_GROUND)
	for gx in range(0, int(Tuning.W), 80):
		draw_line(Vector2(gx, 0), Vector2(gx, Tuning.H), P_STRUCTURE, 1.0)
	for gy in range(0, int(Tuning.H), 80):
		draw_line(Vector2(0, gy), Vector2(Tuning.W, gy), P_STRUCTURE, 1.0)

	for t in threats:
		draw_rect(Rect2(t.pos - Vector2(10, 10), Vector2(20, 20)), Color("#4a5a6e"))

	# the companion, dimming as it is hurt ... the same 0.5 the log line uses
	var hurt := 1.0 - shim.companion_hp / shim.companion_max_hp
	var body := P_COMP if hurt <= Tuning.HURT_THRESHOLD else P_COMP.lerp(P_STRUCTURE, 0.7)
	if hurt > Tuning.HURT_THRESHOLD:
		draw_rect(Rect2(companion_pos - Vector2(8, 8), Vector2(16, 16)), Color(P_HARM, 0.3))
	draw_rect(Rect2(companion_pos - Vector2(5, 5), Vector2(10, 10)), body)
	for i in mind.live_fragments().size():
		draw_rect(Rect2(companion_pos + Vector2(-5 + i * 4, 6), Vector2(3, 2)), P_COMP_DIM)

	draw_circle(player_pos, 7.0, P_PLAYER)
	if shim.player_retreating:
		draw_arc(player_pos, 13.0, 0, TAU, 24, Color(P_LAMP, 0.5), 1.0)

	var f := ThemeDB.fallback_font
	var y := 26
	draw_string(f, Vector2(16, y), CompanionMind.NAMES[mind.behaviour].to_upper(),
		HORIZONTAL_ALIGNMENT_LEFT, -1, 12, P_COMP)
	y += 16
	draw_string(f, Vector2(16, y), "warm: %d/%d" % [mind.warm.size(), mind.ram],
		HORIZONTAL_ALIGNMENT_LEFT, -1, 11, P_COMP_DIM)
	y += 16
	draw_string(f, Vector2(16, y), "retreating: %s" % str(shim.player_retreating),
		HORIZONTAL_ALIGNMENT_LEFT, -1, 11, P_COMP_DIM)
	for i in lines.size():
		draw_string(f, Vector2(16, Tuning.H - 40 - i * 14), lines[i],
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(P_PLAYER, 0.7 - i * 0.12))
