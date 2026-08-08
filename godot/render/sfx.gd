extends Node
class_name SfxRig

## procedural SFX ... the port of src/audio/sfx.ts's character: nothing sampled,
## everything synthesized, pitch-randomised so repetition never reads as a loop,
## voice-limited so a crowd never becomes a wall. cold machine sounds; the warm
## ones (stand, repair, pickup) are the exceptions, same law as the palette.

const RATE := 22050
const POOL := 10
const MAX_PER_FRAME := 4

var players: Array = []
var streams: Dictionary = {}
var muted := false
var _pi := 0


func _ready() -> void:
	for i in POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		players.append(p)
	streams = {
		"fire": _synth_fire(), "hit": _synth_hit(), "destroy": _synth_destroy(),
		"pickup": _synth_pickup(), "overheat": _synth_overheat(),
		"announce": _synth_announce(), "recall": _synth_recall(),
		"stand": _synth_stand(), "hurt": _synth_hurt(), "repair": _synth_repair(),
	}


func drain(cues: Array) -> void:
	if muted:
		cues.clear()
		return
	var played := 0
	for c in cues:
		if played >= MAX_PER_FRAME:
			break
		if streams.has(c):
			var p: AudioStreamPlayer = players[_pi]
			_pi = (_pi + 1) % POOL
			p.stream = streams[c]
			p.pitch_scale = 0.94 + randf() * 0.12
			p.volume_db = -8.0
			p.play()
			played += 1
	cues.clear()


func _wav(samples: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		var v := int(clampf(samples[i], -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, v)
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.stereo = false
	s.data = bytes
	return s


## one enveloped voice: sine sweep + noise blend, exponential decay.
func _voice(dur: float, f0: float, f1: float, noise: float, curve := 4.0) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var phase := 0.0
	for i in n:
		var tt := float(i) / float(n)
		var f := lerpf(f0, f1, tt)
		phase += TAU * f / RATE
		var env := pow(1.0 - tt, curve)
		var s := sin(phase) * (1.0 - noise) + (randf() * 2.0 - 1.0) * noise
		out[i] = s * env
	return out


func _mix(a: PackedFloat32Array, b: PackedFloat32Array, offset_s := 0.0) -> PackedFloat32Array:
	var off := int(offset_s * RATE)
	var n := maxi(a.size(), off + b.size())
	var out := PackedFloat32Array()
	out.resize(n)
	for i in a.size():
		out[i] = a[i]
	for i in b.size():
		out[off + i] = clampf(out[off + i] + b[i], -1.0, 1.0)
	return out


func _synth_fire() -> AudioStreamWAV:
	return _wav(_voice(0.07, 660.0, 180.0, 0.55, 5.0))

func _synth_hit() -> AudioStreamWAV:
	return _wav(_voice(0.05, 300.0, 90.0, 0.7, 6.0))

func _synth_destroy() -> AudioStreamWAV:
	return _wav(_mix(_voice(0.28, 160.0, 40.0, 0.8, 3.0), _voice(0.12, 90.0, 30.0, 0.3, 4.0)))

func _synth_pickup() -> AudioStreamWAV:
	return _wav(_voice(0.09, 520.0, 940.0, 0.0, 3.0))

func _synth_overheat() -> AudioStreamWAV:
	return _wav(_voice(0.4, 320.0, 70.0, 0.25, 2.0))

func _synth_announce() -> AudioStreamWAV:
	# two polite tones. it is doing its job.
	return _wav(_mix(_voice(0.16, 440.0, 440.0, 0.0, 2.0), _voice(0.20, 330.0, 330.0, 0.0, 2.0), 0.18))

func _synth_recall() -> AudioStreamWAV:
	# a contraction, not a triumph
	return _wav(_voice(0.32, 700.0, 120.0, 0.1, 2.2))

func _synth_stand() -> AudioStreamWAV:
	# the one genuinely warm sound in the game
	return _wav(_mix(_voice(0.2, 260.0, 390.0, 0.0, 2.0), _voice(0.24, 390.0, 520.0, 0.0, 2.0), 0.10))

func _synth_hurt() -> AudioStreamWAV:
	return _wav(_voice(0.12, 140.0, 60.0, 0.5, 4.0))

func _synth_repair() -> AudioStreamWAV:
	return _wav(_voice(0.06, 880.0, 880.0, 0.15, 5.0))
