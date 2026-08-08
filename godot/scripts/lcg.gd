extends RefCounted
class_name Lcg

## the seeded stream. law 7: REPLAYABLE, not re-seeded ... one persistent stream drawn
## sequentially. the web build paid for this: a fresh generator per spawn read only its
## first value, adjacent seeds do not give independent first draws, and a probability
## became a hard threshold (0% casters below it, 100% above).

var s: int


func _init(seed_v: int) -> void:
	s = seed_v | 1


static func from_string(text: String) -> Lcg:
	# djb2, like the web's string-seeded rng: stable across runs and platforms
	var h := 5381
	for i in text.length():
		h = ((h << 5) + h + text.unicode_at(i)) & 0x7FFFFFFF
	return Lcg.new(h)


func next() -> float:
	s = (s * 16807) % 2147483647
	if s < 0:
		s += 2147483647
	return float(s) / 2147483647.0
