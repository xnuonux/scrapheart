extends Node2D
class_name VfxRig

## particles, pooled and code-built. CPUParticles2D everywhere because the target is
## GL compatibility + mid-range android, and a particle the phone cannot draw is
## slop with a framerate bill. motivated motion only: sparks mean a hit landed,
## debris means a machine ended, motes mean the air itself is old and dry.

const SPARK_POOL := 6
const DEBRIS_POOL := 4

var sparks: Array = []
var debris: Array = []
var ring: CPUParticles2D
var motes: CPUParticles2D
var heart: CPUParticles2D
var _spark_i := 0
var _debris_i := 0
var _square: ImageTexture


func _ready() -> void:
	var img := Image.create(2, 2, false, Image.FORMAT_RGBA8)
	img.fill(Color.WHITE)
	_square = ImageTexture.create_from_image(img)

	for i in SPARK_POOL:
		sparks.append(_make_sparks())
	for i in DEBRIS_POOL:
		debris.append(_make_debris())
	ring = _make_ring()
	heart = _make_heart()
	motes = _make_motes()


func _base(amount: int, life: float) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.emitting = false
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = amount
	p.lifetime = life
	p.texture = _square
	p.gravity = Vector2.ZERO
	add_child(p)
	return p


func _make_sparks() -> CPUParticles2D:
	var p := _base(9, 0.32)
	p.direction = Vector2.RIGHT
	p.spread = 180.0
	p.initial_velocity_min = 60.0
	p.initial_velocity_max = 160.0
	p.damping_min = 120.0
	p.damping_max = 220.0
	p.scale_amount_min = 0.8
	p.scale_amount_max = 1.6
	p.color = Palette.LAMP
	var g := Gradient.new()
	g.colors = PackedColorArray([Palette.at(Palette.LAMP, 1.0), Palette.at(Palette.HARM, 0.6), Palette.at(Palette.HARM, 0.0)])
	g.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	p.color_ramp = g
	return p


func _make_debris() -> CPUParticles2D:
	var p := _base(14, 0.65)
	p.spread = 180.0
	p.initial_velocity_min = 40.0
	p.initial_velocity_max = 130.0
	p.damping_min = 80.0
	p.damping_max = 160.0
	p.scale_amount_min = 1.0
	p.scale_amount_max = 2.2
	p.angular_velocity_min = -280.0
	p.angular_velocity_max = 280.0
	var g := Gradient.new()
	g.colors = PackedColorArray([Palette.at(Palette.MACHINE_HI, 1.0), Palette.at(Palette.MACHINE, 0.8), Palette.at(Palette.MACHINE, 0.0)])
	g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	p.color_ramp = g
	return p


func _make_ring() -> CPUParticles2D:
	# the recall: cold contraction. particles pulled INWARD, because leaving is a
	# contraction and the screen agrees with the fiction.
	var p := _base(26, 0.5)
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE_SURFACE
	p.emission_sphere_radius = 90.0
	p.radial_accel_min = -600.0
	p.radial_accel_max = -420.0
	p.initial_velocity_min = 0.0
	p.initial_velocity_max = 8.0
	p.scale_amount_min = 0.8
	p.scale_amount_max = 1.4
	var g := Gradient.new()
	g.colors = PackedColorArray([Palette.at(Palette.COMP, 0.0), Palette.at(Palette.COMP, 0.8), Palette.at(Palette.COMP, 0.0)])
	g.offsets = PackedFloat32Array([0.0, 0.4, 1.0])
	p.color_ramp = g
	return p


## IND-34k: something in it is still on. the light leaving the handler rises instead
## of scattering ... it is not debris, it is the opposite of debris.
func _make_heart() -> CPUParticles2D:
	var p := _base(18, 1.4)
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 8.0
	p.direction = Vector2(0, -1)
	p.spread = 24.0
	p.gravity = Vector2(0, -26.0)
	p.initial_velocity_min = 8.0
	p.initial_velocity_max = 22.0
	p.scale_amount_min = 0.7
	p.scale_amount_max = 1.5
	var g := Gradient.new()
	g.colors = PackedColorArray([Palette.at(Palette.PLAYER_HI, 0.0), Palette.at(Palette.PLAYER_HI, 0.9), Palette.at(Palette.GLOW, 0.0)])
	g.offsets = PackedFloat32Array([0.0, 0.25, 1.0])
	p.color_ramp = g
	return p


func _make_motes() -> CPUParticles2D:
	# the air is old and dry. barely-there dust riding a slow drift, always on,
	# following the camera so the field never runs out of it.
	var p := CPUParticles2D.new()
	p.amount = 34
	p.lifetime = 7.0
	p.preprocess = 7.0
	p.texture = _square
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(760, 480)
	p.direction = Vector2(1, 0.15)
	p.spread = 20.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = 6.0
	p.initial_velocity_max = 18.0
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.0
	var g := Gradient.new()
	g.colors = PackedColorArray([Palette.at(Palette.DUST, 0.0), Palette.at(Palette.DUST, 0.16), Palette.at(Palette.DUST, 0.0)])
	g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
	p.color_ramp = g
	p.emitting = true
	add_child(p)
	return p


func spend(kind: String, pos: Vector2) -> void:
	match kind:
		"hit":
			var s: CPUParticles2D = sparks[_spark_i]
			_spark_i = (_spark_i + 1) % SPARK_POOL
			s.position = pos
			s.restart()
		"destroy":
			var d: CPUParticles2D = debris[_debris_i]
			_debris_i = (_debris_i + 1) % DEBRIS_POOL
			d.position = pos
			d.restart()
		"recall":
			ring.position = pos
			ring.restart()
		"heartdrop":
			heart.position = pos
			heart.restart()


func follow_camera(cam_pos: Vector2) -> void:
	motes.position = cam_pos
