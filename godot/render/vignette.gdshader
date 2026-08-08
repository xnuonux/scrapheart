// the vignette ... the dark closes in, and in dust it closes in FURTHER, so the player
// feels the same loss of perception the companion is taking as a stat.
//
// the web build cached this as a quarter-res canvas because canvas gradients are
// expensive. here it is one fragment shader on one full-screen rect: the GPU does the
// radial falloff for free, and `dust` is a uniform so the storm thickening never
// rebuilds anything.
shader_type canvas_item;

uniform float dust : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec2 uv = UV - vec2(0.5);
	float d = length(uv) * 2.0;                    // 0 centre, 1 at the short edge
	float inner = 0.30 - dust * 0.22;
	float outer = 1.02 - dust * 0.42;
	float v = smoothstep(inner, max(outer, inner + 0.05), d);
	// the dust tint rides the same rect: one pass, not two
	vec3 col = mix(vec3(0.0), vec3(0.227, 0.278, 0.341), dust * 0.18);
	COLOR = vec4(col, v * 0.78 + dust * 0.16 * (1.0 - v));
}
