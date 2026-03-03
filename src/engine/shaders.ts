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

// Vertex shader for positioned image blits:
// position controls on-canvas placement, while uv stays local to the image.
export const positionedImageVertexShader = `
precision mediump float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  // Flip Y for HTML image textures (top-left origin).
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = vec4(position, 0, 1);
}
`;

// Vertex shader for positioned solid-color quad blits.
export const positionedColorVertexShader = `
precision mediump float;
attribute vec2 position;

void main() {
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

// Fragment shader for rendering a constant color.
export const solidColorFragmentShader = `
precision mediump float;
uniform vec4 fillColor;

void main() {
  gl_FragColor = fillColor;
}
`;

// ----------------------------------------------------------------------
// Effect Blending — Mixes original with effect using opacity and blend mode
// ----------------------------------------------------------------------
export const blendEffectShader = `
precision mediump float;
uniform sampler2D tOriginal;
uniform sampler2D tEffect;
uniform float opacity;
uniform int blendMode;
varying vec2 vUv;

// Blend mode implementations
vec3 blendNormal(vec3 base, vec3 blend) { return blend; }
vec3 blendMultiply(vec3 base, vec3 blend) { return base * blend; }
vec3 blendScreen(vec3 base, vec3 blend) { return 1.0 - ((1.0 - base) * (1.0 - blend)); }
vec3 blendOverlay(vec3 base, vec3 blend) {
  return vec3(
    base.r < 0.5 ? (2.0 * base.r * blend.r) : (1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r)),
    base.g < 0.5 ? (2.0 * base.g * blend.g) : (1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g)),
    base.b < 0.5 ? (2.0 * base.b * blend.b) : (1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b))
  );
}
vec3 blendSoftLight(vec3 base, vec3 blend) {
  return vec3(
    blend.r < 0.5 ? (2.0 * base.r * blend.r + base.r * base.r * (1.0 - 2.0 * blend.r)) : (sqrt(base.r) * (2.0 * blend.r - 1.0) + 2.0 * base.r * (1.0 - blend.r)),
    blend.g < 0.5 ? (2.0 * base.g * blend.g + base.g * base.g * (1.0 - 2.0 * blend.g)) : (sqrt(base.g) * (2.0 * blend.g - 1.0) + 2.0 * base.g * (1.0 - blend.g)),
    blend.b < 0.5 ? (2.0 * base.b * blend.b + base.b * base.b * (1.0 - 2.0 * blend.b)) : (sqrt(base.b) * (2.0 * blend.b - 1.0) + 2.0 * base.b * (1.0 - blend.b))
  );
}
vec3 blendHardLight(vec3 base, vec3 blend) { return blendOverlay(blend, base); }
vec3 blendDifference(vec3 base, vec3 blend) { return abs(base - blend); }
vec3 blendExclusion(vec3 base, vec3 blend) { return base + blend - 2.0 * base * blend; }
vec3 blendColorDodge(vec3 base, vec3 blend) {
  return vec3(
    blend.r == 1.0 ? 1.0 : min(1.0, base.r / (1.0 - blend.r)),
    blend.g == 1.0 ? 1.0 : min(1.0, base.g / (1.0 - blend.g)),
    blend.b == 1.0 ? 1.0 : min(1.0, base.b / (1.0 - blend.b))
  );
}
vec3 blendColorBurn(vec3 base, vec3 blend) {
  return vec3(
    blend.r == 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.r) / blend.r),
    blend.g == 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.g) / blend.g),
    blend.b == 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.b) / blend.b)
  );
}

void main() {
    vec4 orig = texture2D(tOriginal, vUv);
    vec4 eff = texture2D(tEffect, vUv);
    float effectAlpha = clamp(eff.a * opacity, 0.0, 1.0);
    
    vec3 blended;
  if (blendMode == 0) blended = blendNormal(orig.rgb, eff.rgb);
  else if (blendMode == 1) blended = blendMultiply(orig.rgb, eff.rgb);
  else if (blendMode == 2) blended = blendScreen(orig.rgb, eff.rgb);
  else if (blendMode == 3) blended = blendOverlay(orig.rgb, eff.rgb);
  else if (blendMode == 4) blended = blendSoftLight(orig.rgb, eff.rgb);
  else if (blendMode == 5) blended = blendHardLight(orig.rgb, eff.rgb);
  else if (blendMode == 6) blended = blendDifference(orig.rgb, eff.rgb);
  else if (blendMode == 7) blended = blendExclusion(orig.rgb, eff.rgb);
  else if (blendMode == 8) blended = blendColorDodge(orig.rgb, eff.rgb);
  else if (blendMode == 9) blended = blendColorBurn(orig.rgb, eff.rgb);
  else blended = eff.rgb;
    
    vec3 finalColor = mix(orig.rgb, blended, effectAlpha);
    float finalAlpha = effectAlpha + orig.a * (1.0 - effectAlpha);

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

// ----------------------------------------------------------------------
// Layer Blending — Composites a layer onto the composite FBO with blend mode + opacity
// ----------------------------------------------------------------------
export const blendLayerShader = `
precision mediump float;
uniform sampler2D tBase;
uniform sampler2D tLayer;
uniform float opacity;
uniform int blendMode;
varying vec2 vUv;

vec3 blendNormal(vec3 base, vec3 blend) { return blend; }
vec3 blendMultiply(vec3 base, vec3 blend) { return base * blend; }
vec3 blendScreen(vec3 base, vec3 blend) { return 1.0 - ((1.0 - base) * (1.0 - blend)); }
vec3 blendOverlay(vec3 base, vec3 blend) {
  return vec3(
    base.r < 0.5 ? (2.0 * base.r * blend.r) : (1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r)),
    base.g < 0.5 ? (2.0 * base.g * blend.g) : (1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g)),
    base.b < 0.5 ? (2.0 * base.b * blend.b) : (1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b))
  );
}
vec3 blendSoftLight(vec3 base, vec3 blend) {
  return vec3(
    blend.r < 0.5 ? (2.0 * base.r * blend.r + base.r * base.r * (1.0 - 2.0 * blend.r)) : (sqrt(base.r) * (2.0 * blend.r - 1.0) + 2.0 * base.r * (1.0 - blend.r)),
    blend.g < 0.5 ? (2.0 * base.g * blend.g + base.g * base.g * (1.0 - 2.0 * blend.g)) : (sqrt(base.g) * (2.0 * blend.g - 1.0) + 2.0 * base.g * (1.0 - blend.g)),
    blend.b < 0.5 ? (2.0 * base.b * blend.b + base.b * base.b * (1.0 - 2.0 * blend.b)) : (sqrt(base.b) * (2.0 * blend.b - 1.0) + 2.0 * base.b * (1.0 - blend.b))
  );
}
vec3 blendHardLight(vec3 base, vec3 blend) { return blendOverlay(blend, base); }
vec3 blendDifference(vec3 base, vec3 blend) { return abs(base - blend); }
vec3 blendExclusion(vec3 base, vec3 blend) { return base + blend - 2.0 * base * blend; }
vec3 blendColorDodge(vec3 base, vec3 blend) {
  return vec3(
    blend.r == 1.0 ? 1.0 : min(1.0, base.r / (1.0 - blend.r)),
    blend.g == 1.0 ? 1.0 : min(1.0, base.g / (1.0 - blend.g)),
    blend.b == 1.0 ? 1.0 : min(1.0, base.b / (1.0 - blend.b))
  );
}
vec3 blendColorBurn(vec3 base, vec3 blend) {
  return vec3(
    blend.r == 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.r) / blend.r),
    blend.g == 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.g) / blend.g),
    blend.b == 0.0 ? 0.0 : max(0.0, 1.0 - (1.0 - base.b) / blend.b)
  );
}

void main() {
    vec4 base = texture2D(tBase, vUv);
    vec4 layer = texture2D(tLayer, vUv);
    
    float layerAlpha = layer.a * opacity;
    
    vec3 blended;
    if (blendMode == 0) blended = blendNormal(base.rgb, layer.rgb);
    else if (blendMode == 1) blended = blendMultiply(base.rgb, layer.rgb);
    else if (blendMode == 2) blended = blendScreen(base.rgb, layer.rgb);
    else if (blendMode == 3) blended = blendOverlay(base.rgb, layer.rgb);
    else if (blendMode == 4) blended = blendSoftLight(base.rgb, layer.rgb);
    else if (blendMode == 5) blended = blendHardLight(base.rgb, layer.rgb);
    else if (blendMode == 6) blended = blendDifference(base.rgb, layer.rgb);
    else if (blendMode == 7) blended = blendExclusion(base.rgb, layer.rgb);
    else if (blendMode == 8) blended = blendColorDodge(base.rgb, layer.rgb);
    else if (blendMode == 9) blended = blendColorBurn(base.rgb, layer.rgb);
    else blended = layer.rgb;
    
    vec3 finalRgb = mix(base.rgb, blended, layerAlpha);
    float finalAlpha = layerAlpha + base.a * (1.0 - layerAlpha);
    
    gl_FragColor = vec4(finalRgb, finalAlpha);
}
`;

// ----------------------------------------------------------------------
// Mask Application — Mixes base and masked segment by mask alpha
// ----------------------------------------------------------------------
export const applyMaskShader = `
precision mediump float;
uniform sampler2D tBase;
uniform sampler2D tSegment;
uniform sampler2D tMask;
uniform int invertMask;
uniform float maskThreshold;
varying vec2 vUv;

void main() {
    vec4 base = texture2D(tBase, vUv);
    vec4 segment = texture2D(tSegment, vUv);
    vec4 mask = texture2D(tMask, vUv);
    
    // Prefer alpha masking. For fully opaque mask images (e.g. JPEG),
    // fall back to a luminance threshold to avoid global semi-opacity fades.
    float lum = dot(mask.rgb, vec3(0.299, 0.587, 0.114));
    float alphaMask = mask.a;
    float luminanceMask = step(maskThreshold, lum);
    float useLuminance = step(0.999, alphaMask);
    float maskValue = mix(alphaMask, luminanceMask, useLuminance);
    
    if (invertMask == 1) {
        maskValue = 1.0 - maskValue;
    }
    
    gl_FragColor = mix(base, segment, clamp(maskValue, 0.0, 1.0));
}
`;
