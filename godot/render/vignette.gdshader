// THE HAZE ... the one pass that marries the layers (IND-34o: "if the layers ever
// read as separate, the haze is too thin"). vignette + dust + depth-cold grade +
// film grain, all in a single full-screen fragment. uniforms move, nothing rebuilds.
shader_type canvas_item;

uniform float dust : hint_range(0.0, 1.0) = 0.0;
uniform float depth : hint_range(0.0, 1.0) = 0.0;
uniform float hurt : hint_range(0.0, 1.0) = 0.0;   // the moment you got hit, decaying

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void fragment() {
	vec2 uv = UV - vec2(0.5);
	float d = length(uv) * 2.0;
	float inner = 0.30 - dust * 0.22;
	float outer = 1.02 - dust * 0.42;
	float v = smoothstep(inner, max(outer, inner + 0.05), d);

	// the dark that closes in, tinted by dust when the storm sits on you
	vec3 col = mix(vec3(0.0), vec3(0.227, 0.278, 0.341), dust * 0.18);
	float a = v * 0.78 + dust * 0.16 * (1.0 - v);

	// the deep is COLDER, not just darker: a blue veil that thickens eastward.
	// unmarked, unlabelled ... the grade is the only signage the deep gets.
	col = mix(col, vec3(0.10, 0.14, 0.22), depth * 0.5);
	a += depth * 0.14 * v;   // the veil lives at the edges; the center stays readable

	// film grain, dark-only, animated. old air on an old lens. kept subtle enough
	// that you notice its absence rather than its presence.
	float g = hash(UV * vec2(1607.0, 1201.0) + vec2(TIME * 61.7, TIME * 43.3));
	a += (g - 0.5) * 0.055;

	// 🚨 HARM IS THE ONLY SATURATED COLOUR IN THE GAME, and this is its second moving
	// surface: when you are hit, the EDGE of the screen carries it. harm rides the
	// same vignette falloff the dark does, so the pain lives where the danger lives.
	col = mix(col, vec3(0.788, 0.255, 0.310), hurt * 0.8);
	a += hurt * v * 0.35;

	COLOR = vec4(col, clamp(a, 0.0, 1.0));
}
