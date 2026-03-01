// ----------------------------------------------------------------------
// Base Pipeline Shaders
// ----------------------------------------------------------------------

// Vertex shader for FBO-to-FBO passes (no Y-flip — FBOs have correct orientation)
export const baseVertexShader = `
precision mediump float;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = 0.5 * (position + 1.0);
  gl_Position = vec4(position, 0, 1);
}
`;

// Vertex shader for reading from image textures (flip Y — images have top-left origin)
export const flipVertexShader = `
precision mediump float;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = 0.5 * (position + 1.0);
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(position, 0, 1);
}
`;

// A simple passthrough fragment shader, used for simply drawing a texture to the screen
export const passthroughFragmentShader = `
precision mediump float;
uniform sampler2D tInput;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(tInput, vUv);
}
`;

// ----------------------------------------------------------------------
// Effect Shaders (The actual image math)
// ----------------------------------------------------------------------

export const brightnessContrastShader = `
precision mediump float;
uniform sampler2D tInput;
uniform float brightness; // Range: -1.0 to 1.0
uniform float contrast;   // Range: -1.0 to 1.0
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tInput, vUv);
  
  // Apply Brightness
  color.rgb += brightness;
  
  // Apply Contrast
  if (contrast > 0.0) {
    color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
  } else {
    color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
  }
  
  gl_FragColor = color;
}
`;

export const blackWhiteShader = `
precision mediump float;
uniform sampler2D tInput;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tInput, vUv);
  
  // Standard luminance dot product representation for human eye
  float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  
  gl_FragColor = vec4(vec3(luminance), color.a);
}
`;

// ----------------------------------------------------------------------
// Levels — Input/output range remap
// ----------------------------------------------------------------------
export const levelsShader = `
precision mediump float;
uniform sampler2D tInput;
uniform float inBlack;   // 0.0 – 1.0  (default 0)
uniform float inWhite;   // 0.0 – 1.0  (default 1)
uniform float gamma;     // 0.1 – 4.0  (default 1)
uniform float outBlack;  // 0.0 – 1.0  (default 0)
uniform float outWhite;  // 0.0 – 1.0  (default 1)
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tInput, vUv);

  // Input range remap
  vec3 c = clamp((color.rgb - inBlack) / max(inWhite - inBlack, 0.001), 0.0, 1.0);

  // Gamma correction
  c = pow(c, vec3(1.0 / max(gamma, 0.01)));

  // Output range remap
  c = mix(vec3(outBlack), vec3(outWhite), c);

  gl_FragColor = vec4(c, color.a);
}
`;

// ----------------------------------------------------------------------
// Curves — Simplified S-curve using cubic Bezier approximation
// ----------------------------------------------------------------------
export const curvesShader = `
precision mediump float;
uniform sampler2D tInput;
uniform float shadows;    // -1.0 – 1.0  lift/push shadows
uniform float midtones;   // -1.0 – 1.0  adjust midtone gamma
uniform float highlights; // -1.0 – 1.0  lift/pull highlights
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tInput, vUv);

  // Apply per-channel tone adjustments using a simplified power curve
  vec3 c = color.rgb;

  // Shadows: bias low values
  c = c + shadows * (1.0 - c) * c;

  // Midtones: gamma shift
  float midGamma = 1.0 / max(1.0 + midtones, 0.01);
  c = pow(c, vec3(midGamma));

  // Highlights: bias high values
  c = c + highlights * c * c;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), color.a);
}
`;

// ----------------------------------------------------------------------
// Selective Color — HSL range isolation + per-channel adjust
// ----------------------------------------------------------------------
export const selectiveColorShader = `
precision mediump float;
uniform sampler2D tInput;
uniform float hueCenter;   // 0.0 – 1.0  target hue (e.g. 0.0 = red)
uniform float hueRange;    // 0.0 – 0.5  selection width
uniform float satShift;    // -1.0 – 1.0
uniform float lumShift;    // -1.0 – 1.0
varying vec2 vUv;

vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float s = 0.0;
  float h = 0.0;
  if (mx != mn) {
    float d = mx - mn;
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s == 0.0) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

void main() {
  vec4 color = texture2D(tInput, vUv);
  vec3 hsl = rgb2hsl(color.rgb);

  // Compute circular hue distance
  float dist = abs(hsl.x - hueCenter);
  dist = min(dist, 1.0 - dist);

  // Smooth selection mask
  float mask = 1.0 - smoothstep(hueRange * 0.5, hueRange, dist);
  mask *= hsl.y; // Weight by saturation so grays aren't affected

  hsl.y = clamp(hsl.y + satShift * mask, 0.0, 1.0);
  hsl.z = clamp(hsl.z + lumShift * mask, 0.0, 1.0);

  gl_FragColor = vec4(hsl2rgb(hsl), color.a);
}
`;

// ----------------------------------------------------------------------
// Unsharp Mask — Gaussian blur → subtract → sharpen
// ----------------------------------------------------------------------
export const unsharpMaskShader = `
precision mediump float;
uniform sampler2D tInput;
uniform vec2 texelSize;  // 1.0 / vec2(width, height)
uniform float amount;    // 0.0 – 3.0
uniform float radius;    // 0.5 – 5.0  (controls blur kernel spread)
varying vec2 vUv;

void main() {
  vec4 original = texture2D(tInput, vUv);

  // 9-tap Gaussian blur approximation
  vec4 blur = vec4(0.0);
  float r = radius;
  blur += texture2D(tInput, vUv + vec2(-r, -r) * texelSize) * 0.0625;
  blur += texture2D(tInput, vUv + vec2( 0.0, -r) * texelSize) * 0.125;
  blur += texture2D(tInput, vUv + vec2( r, -r) * texelSize) * 0.0625;
  blur += texture2D(tInput, vUv + vec2(-r,  0.0) * texelSize) * 0.125;
  blur += texture2D(tInput, vUv) * 0.25;
  blur += texture2D(tInput, vUv + vec2( r,  0.0) * texelSize) * 0.125;
  blur += texture2D(tInput, vUv + vec2(-r,  r) * texelSize) * 0.0625;
  blur += texture2D(tInput, vUv + vec2( 0.0,  r) * texelSize) * 0.125;
  blur += texture2D(tInput, vUv + vec2( r,  r) * texelSize) * 0.0625;

  // Unsharp mask = original + amount * (original - blur)
  vec4 sharpened = original + amount * (original - blur);

  gl_FragColor = vec4(clamp(sharpened.rgb, 0.0, 1.0), original.a);
}
`;

// ----------------------------------------------------------------------
// Add Noise — Pseudo-random per-pixel GLSL noise
// ----------------------------------------------------------------------
export const addNoiseShader = `
precision mediump float;
uniform sampler2D tInput;
uniform float noiseAmount;  // 0.0 – 1.0
uniform float seed;         // Animated seed for variation
varying vec2 vUv;

// Hash-based pseudo random
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec4 color = texture2D(tInput, vUv);

  float noise = random(vUv + seed) * 2.0 - 1.0;
  color.rgb += noise * noiseAmount;

  gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
}
`;

// ----------------------------------------------------------------------
// Ripple — UV displacement via sine wave
// ----------------------------------------------------------------------
export const rippleShader = `
precision mediump float;
uniform sampler2D tInput;
uniform float amplitude;   // 0.0 – 0.05  pixel displacement strength
uniform float frequency;   // 1.0 – 50.0  wave frequency
uniform float phase;       // 0.0 – 6.28  animation offset
varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // Horizontal + vertical sine displacement
  uv.x += sin(uv.y * frequency + phase) * amplitude;
  uv.y += cos(uv.x * frequency + phase) * amplitude;

  gl_FragColor = texture2D(tInput, clamp(uv, 0.0, 1.0));
}
`;

// ----------------------------------------------------------------------
// Minimum (Erode) — Morphological: select darkest neighbor
// ----------------------------------------------------------------------
export const minimumShader = `
precision mediump float;
uniform sampler2D tInput;
uniform vec2 texelSize;  // 1.0 / vec2(width, height)
uniform float radius;    // 1.0 – 5.0
varying vec2 vUv;

void main() {
  vec4 minColor = texture2D(tInput, vUv);

  // Sample 3x3 neighborhood
  for (float x = -1.0; x <= 1.0; x += 1.0) {
    for (float y = -1.0; y <= 1.0; y += 1.0) {
      vec2 offset = vec2(x, y) * texelSize * radius;
      vec4 s = texture2D(tInput, vUv + offset);
      minColor = min(minColor, s);
    }
  }

  gl_FragColor = minColor;
}
`;

// ----------------------------------------------------------------------
// Find Edges — Sobel operator kernel
// ----------------------------------------------------------------------
export const findEdgesShader = `
precision mediump float;
uniform sampler2D tInput;
uniform vec2 texelSize;  // 1.0 / vec2(width, height)
uniform float strength;  // 0.5 – 3.0
varying vec2 vUv;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  // Sobel kernels
  float tl = luminance(texture2D(tInput, vUv + vec2(-1, -1) * texelSize).rgb);
  float tm = luminance(texture2D(tInput, vUv + vec2( 0, -1) * texelSize).rgb);
  float tr = luminance(texture2D(tInput, vUv + vec2( 1, -1) * texelSize).rgb);
  float ml = luminance(texture2D(tInput, vUv + vec2(-1,  0) * texelSize).rgb);
  float mr = luminance(texture2D(tInput, vUv + vec2( 1,  0) * texelSize).rgb);
  float bl = luminance(texture2D(tInput, vUv + vec2(-1,  1) * texelSize).rgb);
  float bm = luminance(texture2D(tInput, vUv + vec2( 0,  1) * texelSize).rgb);
  float br = luminance(texture2D(tInput, vUv + vec2( 1,  1) * texelSize).rgb);

  // Sobel X and Y
  float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
  float gy = -tl - 2.0*tm - tr + bl + 2.0*bm + br;

  float edge = sqrt(gx*gx + gy*gy) * strength;

  gl_FragColor = vec4(vec3(edge), 1.0);
}
`;
