// A minimal, dependency-free WebGL2 helper for fullscreen fragment-shader backgrounds — the
// shared base a `engine: 'webgl'` preset builds on (no Three/regl, to honour the Chromebook
// bundle budget). It compiles a fullscreen-triangle vertex shader + the preset's fragment
// shader, caches uniform locations, and exposes `draw()` / `destroy()`. Returns `null` when
// WebGL2 is unavailable or a shader fails to compile/link, so the preset can fall back to a
// static gradient rather than break the page.

// One oversized triangle covers the viewport; positions come from gl_VertexID, so no vertex
// buffer is needed. `v_uv` is 0..1 across the screen.
const VERTEX_SRC = `#version 300 es
const vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 v_uv;
void main() {
	vec2 p = verts[gl_VertexID];
	v_uv = p * 0.5 + 0.5;
	gl_Position = vec4(p, 0.0, 1.0);
}`;

export interface FullscreenProgram {
	gl: WebGL2RenderingContext;
	/** Make this the active program — call before setting uniforms for a frame. */
	use(): void;
	/** Cached uniform-location lookup (null when the uniform was optimised out). */
	uniform(name: string): WebGLUniformLocation | null;
	/** Bind the program + empty VAO and draw the fullscreen triangle. */
	draw(): void;
	destroy(): void;
}

function compileShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string
): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		// A shader that won't compile must not crash the page; the caller falls back.
		if (typeof console !== 'undefined') console.warn(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

/** Build a fullscreen-quad program from a fragment shader, or `null` if WebGL2/compile fails. */
export function createFullscreenProgram(
	canvas: HTMLCanvasElement,
	fragmentSource: string
): FullscreenProgram | null {
	const gl = canvas.getContext('webgl2', {
		antialias: false,
		alpha: true,
		premultipliedAlpha: false,
		depth: false,
		powerPreference: 'low-power'
	});
	if (!gl) return null;

	const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	if (!vs || !fs) return null;

	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		if (typeof console !== 'undefined') console.warn(gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}

	const vao = gl.createVertexArray();
	const locations = new Map<string, WebGLUniformLocation | null>();

	return {
		gl,
		use() {
			gl.useProgram(program);
		},
		uniform(name) {
			if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
			return locations.get(name) ?? null;
		},
		draw() {
			gl.useProgram(program);
			gl.bindVertexArray(vao);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.bindVertexArray(null);
		},
		destroy() {
			gl.deleteVertexArray(vao);
			gl.deleteProgram(program);
		}
	};
}
