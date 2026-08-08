extends Control

## the HUD. reads the world, never owns state. the web build's law holds here: the
## game has ZERO buttons anywhere. the pack panel is click-a-row, and the name field
## is deliberately unlabelled ... 🚨 the gate is "seven name the companion UNPROMPTED",
## and a control labelled "give it a name" would produce a number that looked like a
## pass while measuring obedience instead of attachment.

var game = null   # game.gd Node2D; untyped so the cross-script surface stays duck-typed
var pack_open := false
var name_edit: LineEdit


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	# the name field. unlabelled. reads "unnamed". absent from the key hints.
	name_edit = LineEdit.new()
	name_edit.placeholder_text = "unnamed"
	name_edit.max_length = 24
	name_edit.visible = false
	name_edit.flat = true
	name_edit.position = Vector2(0, 0)   # placed when the panel opens
	name_edit.size = Vector2(150, 22)
	name_edit.add_theme_color_override("font_color", Palette.COMP)
	name_edit.add_theme_color_override("font_placeholder_color", Palette.at(Palette.COMP_DIM, 0.7))
	name_edit.text_submitted.connect(_on_name_submitted)
	add_child(name_edit)


func toggle_pack() -> void:
	pack_open = not pack_open
	mouse_filter = Control.MOUSE_FILTER_STOP if pack_open else Control.MOUSE_FILTER_IGNORE
	name_edit.visible = pack_open and game.world.mind != null
	if not pack_open:
		name_edit.release_focus()


func _on_name_submitted(text: String) -> void:
	var w: GameWorld = game.world
	if w.mind == null:
		return
	var trimmed := text.strip_edges()
	if trimmed == "" or trimmed == w.comp_name:
		return
	w.comp_name = trimmed
	w.named = true
	name_edit.release_focus()
	# no confirmation line. the name simply starts being used.


func _panel_rect() -> Rect2:
	return Rect2(size.x / 2.0 - 240, size.y / 2.0 - 170, 480, 340)


func _gui_input(event: InputEvent) -> void:
	if not pack_open or game == null:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_click(event.position)


## install by click: a pack row, then a socket. remove by clicking a filled socket.
## ⚠ the costs are the teacher: pulling degrades (0.28 → 0.56 → 0.84 → gone).
var _selected_pack := -1

func _click(pos: Vector2) -> void:
	var w: GameWorld = game.world
	var r := _panel_rect()
	if not r.has_point(pos):
		toggle_pack()
		return
	if w.mind == null:
		return
	# socket rows
	for i in w.mind.installed.size():
		var srect := Rect2(r.position.x + 24, r.position.y + 92 + i * 30, 300, 26)
		if srect.has_point(pos):
			if w.mind.installed[i] != null:
				var out: Dictionary = w.mind.remove(i)
				if out.destroyed:
					w.log_line("it came apart in your hands.")
				elif out.fragment != null:
					w.pack.append(out.fragment)
				return
			elif _selected_pack >= 0 and _selected_pack < w.pack.size():
				var f = w.pack[_selected_pack]
				if w.mind.install(f, i):
					w.pack.remove_at(_selected_pack)
					_selected_pack = -1
				return
	# pack rows
	for j in w.pack.size():
		var prect := Rect2(r.position.x + 24, r.position.y + 92 + (w.mind.installed.size() + 1) * 30 + j * 24, 300, 22)
		if prect.has_point(pos):
			_selected_pack = -1 if _selected_pack == j else j
			return


func _draw() -> void:
	if game == null:
		return
	var w: GameWorld = game.world
	var f := ThemeDB.fallback_font

	# ── top left: the companion, read at a glance ──
	if w.mind != null:
		draw_string(f, Vector2(16, 24), w.companion_name() if w.named else "unnamed",
			HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Palette.COMP)
		draw_string(f, Vector2(16, 40), CompanionMind.NAMES[w.mind.behaviour].to_upper(),
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.at(Palette.COMP_DIM, 0.9))
		# sockets as squares, RAM beside them
		var parts: int = w.mind.live_fragments().size()
		for i in w.mind.installed.size():
			var c := Palette.COMP if w.mind.installed[i] != null else Palette.at(Palette.COMP_DIM, 0.4)
			draw_rect(Rect2(16 + i * 14, 48, 10, 10), c, w.mind.installed[i] != null, 1.0)
		draw_string(f, Vector2(16 + w.mind.installed.size() * 14 + 8, 57), "RAM %d" % w.mind.ram,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Palette.at(Palette.COMP_DIM, 0.8))
		# the hurt line under it, same threshold as everything else
		var hurt := 1.0 - w.companion_hp / w.companion_max_hp
		if hurt > 0.0:
			draw_rect(Rect2(16, 62, 44.0, 2), Palette.at(Palette.HARM_DIM, 0.9))
			draw_rect(Rect2(16, 62, 44.0 * (w.companion_hp / w.companion_max_hp), 2),
				Palette.HARM if hurt > Tuning.HURT_THRESHOLD else Palette.at(Palette.COMP, 0.8))

	# ── top right: the log. six lines, fading. ⚠ right-aligned by measuring ... an
	# unbounded width ignores the alignment and the text runs off the screen edge.
	for i in w.logs.size():
		var e = w.logs[i]
		var age: float = w.t - e.t
		var alpha := clampf(1.0 - age / 9.0, 0.0, 1.0) * (1.0 - i * 0.12)
		if alpha <= 0.02:
			continue
		var tw := f.get_string_size(e.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
		draw_string(f, Vector2(size.x - 16 - tw, 24 + i * 16), e.text,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.at(Palette.PLAYER, 0.85 * alpha))

	# ── bottom left: kept, heat, hints ──
	var y := size.y - 64
	draw_string(f, Vector2(16, y), "%d kept" % w.banked.size(),
		HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.at(Palette.SALVAGE, 0.9))
	if w.pack.size() > 0:
		draw_string(f, Vector2(80, y), "%d carried" % w.pack.size(),
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.at(Palette.PLAYER, 0.55))
	# heat: a bar that means restraint. red while locked.
	draw_rect(Rect2(16, y + 10, 160, 4), Palette.at(Palette.STRUCTURE, 0.8))
	draw_rect(Rect2(16, y + 10, 160 * w.heat, 4),
		Palette.HARM if w.overheated > 0.0 else Palette.at(Palette.PLAYER, 0.75))
	draw_string(f, Vector2(16, y + 34),
		"WASD move   click/hold fire   Q leave   E repair   I pack   M mute",
		HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Palette.at(Palette.COMP_DIM, 0.7))

	# ── the run flashes, over everything ──
	if w.death_flash > 0.0:
		var fl := minf(1.0, w.death_flash)
		draw_rect(Rect2(Vector2.ZERO, size), Palette.at(Palette.VOID, fl * 0.94))
		var cy := size.y * 0.36
		draw_string(f, Vector2(size.x / 2.0 - 120, cy), "run %d ended" % (w.run - 1),
			HORIZONTAL_ALIGNMENT_CENTER, 240, 12, Palette.at(Palette.PLAYER, 0.55 * minf(1.0, fl * 1.6)))
		if w.records.size() > 0:
			var r0: Dictionary = w.records[0]
			var line: String = ("%ds, and the %d you kept are gone too" % [r0.seconds, r0.kept]) if r0.kept > 0 \
				else ("%ds, and you had nothing to lose" % r0.seconds)
			draw_string(f, Vector2(size.x / 2.0 - 200, cy + 20), line,
				HORIZONTAL_ALIGNMENT_CENTER, 400, 11, Palette.at(Palette.COMP_DIM, 0.75 * minf(1.0, fl * 1.6)))
	if w.recall_flash > 0.0:
		draw_rect(Rect2(Vector2.ZERO, size), Palette.at(Palette.VOID, w.recall_flash * 0.85))

	# ── the pack panel ──
	if pack_open:
		_draw_pack(f, w)


func _draw_pack(f: Font, w: GameWorld) -> void:
	var r := _panel_rect()
	draw_rect(r, Palette.at(Palette.VOID, 0.92))
	draw_rect(r, Palette.at(Palette.STRUCTURE, 0.9), false, 1.0)
	draw_string(f, r.position + Vector2(24, 28), "pack", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Palette.PLAYER)

	if w.mind == null:
		draw_string(f, r.position + Vector2(24, 60), "nothing to assemble yet.",
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.at(Palette.COMP_DIM, 0.8))
		name_edit.visible = false
		return

	# the name field sits here, in the place you assemble the thing. unlabelled.
	name_edit.position = r.position + Vector2(300, 16)
	name_edit.visible = true
	if not name_edit.has_focus() and name_edit.text == "" and w.comp_name != "":
		name_edit.text = w.comp_name

	draw_string(f, r.position + Vector2(24, 76), "sockets", HORIZONTAL_ALIGNMENT_LEFT, -1, 10,
		Palette.at(Palette.COMP_DIM, 0.7))
	for i in w.mind.installed.size():
		var yy := r.position.y + 92 + i * 30
		var aux: bool = w.mind.is_aux_slot(i)
		var fr = w.mind.installed[i]
		draw_rect(Rect2(r.position.x + 24, yy, 300, 26), Palette.at(Palette.GROUND2, 0.9))
		if aux:
			draw_rect(Rect2(r.position.x + 24, yy, 300, 26), Palette.at(Palette.COMP_DIM, 0.35), false, 1.0)
		if fr != null:
			var wear := "" if fr.degradation <= 0.0 else "  worn %d%%" % roundi(fr.degradation * 100.0)
			draw_string(f, Vector2(r.position.x + 34, yy + 17), fr.name + wear,
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.COMP)
		else:
			draw_string(f, Vector2(r.position.x + 34, yy + 17), "aux socket, empty" if aux else "empty",
				HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.at(Palette.COMP_DIM, 0.55))

	var py := r.position.y + 92 + (w.mind.installed.size() + 1) * 30
	draw_string(f, Vector2(r.position.x + 24, py - 8), "carried", HORIZONTAL_ALIGNMENT_LEFT, -1, 10,
		Palette.at(Palette.COMP_DIM, 0.7))
	if w.pack.is_empty():
		draw_string(f, Vector2(r.position.x + 34, py + 16), "nothing",
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.at(Palette.COMP_DIM, 0.5))
	for j in w.pack.size():
		var yy2 := py + j * 24
		if j == _selected_pack:
			draw_rect(Rect2(r.position.x + 24, yy2, 300, 22), Palette.at(Palette.COMP_DIM, 0.30))
		var fj = w.pack[j]
		var glow: bool = fj.worn > 0.0
		draw_string(f, Vector2(r.position.x + 34, yy2 + 15), fj.name,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.PLAYER_HI if glow else Palette.PLAYER)
		draw_string(f, Vector2(r.position.x + 210, yy2 + 15), fj.provenance,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Palette.at(Palette.COMP_DIM, 0.6))
