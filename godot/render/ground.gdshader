// THE GROUND ... dry, cold, cracked, dead. IND-34m: "cold, desaturated, grey-blue",
// and light does most of the work, so the ground gives it something to fall on.
//
// value-noise FBM: dirt mottling + crack veins + the old checker as a faint memory,
// and the whole field darkens toward the east because deeper IS darker. no texture
// files anywhere ... the world is procedural and its floor is too.
shader_type canvas_item;

uniform float world_w = 1600.0;
uniform float deep_x = 1080.0;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
	           mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int k = 0; k < 4; k++) {
		v += a * vnoise(p);
		p = p * 2.03 + vec2(17.0);
		a *= 0.5;
	}
	return v;
}

void fragment() {
	// VERTEX arrives via a full-rect draw in world space; recover it from UV painted
	// by the ground node (uv = world / (W,H)).
	vec2 wp = UV * vec2(world_w, world_w * 0.75);

	vec3 g0 = vec3(0.051, 0.071, 0.094);   // ground0
	vec3 g1 = vec3(0.075, 0.102, 0.133);   // ground1
	vec3 g2 = vec3(0.102, 0.137, 0.176);   // ground2

	// dirt mottling, two octav-scales so it reads at both zoom distances
	float m = fbm(wp * 0.012);
	float m2 = fbm(wp * 0.045 + 31.0);
	vec3 col = mix(g0, g1, m * 0.85);
	col = mix(col, g2, smoothstep(0.62, 0.95, m2) * 0.35);

	// crack veins: ridged noise, thin and darker ... the floor of a place that dried
	// out. ⚠ fine-scaled: the first pass read as worm-squiggles from the play camera.
	float c = abs(vnoise(wp * 0.085) - 0.5) * 2.0;
	float crack = 1.0 - smoothstep(0.0, 0.055, c);
	col *= 1.0 - crack * 0.26;

	// the old checker, kept as a FAINT plate seam ... structure, not decoration
	vec2 cell = floor(wp / 160.0);
	float check = mod(cell.x + cell.y, 2.0);
	col *= 1.0 + (check - 0.5) * 0.05;
	// plate seams every 80px, one pixel of slightly lifted edge
	vec2 seam = abs(fract(wp / 80.0) - 0.5);
	float line = 1.0 - smoothstep(0.485, 0.5, max(seam.x, seam.y));
	col = mix(col, vec3(0.137, 0.180, 0.227), (1.0 - line) * 0.10);

	// deeper is east, and east is darker. no wall, no warning ... just less light.
	float depth = clamp((wp.x - 340.0) / (world_w - 480.0), 0.0, 1.0);
	col *= 1.0 - depth * 0.35;
	// and colder: the blue creeps up as the warmth of the anchor falls behind
	col = mix(col, col * vec3(0.85, 0.95, 1.18), depth * 0.5);

	COLOR = vec4(col, 1.0);
}
