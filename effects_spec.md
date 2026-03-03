# Effects Specification

Here is the specification mapping all available visual effects implemented in the engine, grouped by logical categories.

## 🎨 Color Adjustments
Effects used to tune, balance, or completely recolor the input image based on luminance and color channels.

| Effect | Description | Controls |
| :--- | :--- | :--- |
| **Brightness / Contrast** | Standard adjustment of image brightness and contrast. | **Brightness** (Slider: -150% - 150%)<br>**Contrast** (Slider: -100% - 100%)<br>**Use Legacy** (Checkbox) |
| **Black & White** | Converts the image to grayscale, allowing color-specific luminance weighting and optional tinting. | **Preset** (Select)<br>**Reds, Yellows, Greens, Cyans, Blues, Magentas** (Sliders: -200% - 300%)<br>**Tint** (Checkbox)<br>**Tint Color** (Color) |
| **Levels** | Adjusts tonal range and color balance by setting shadows, midtones (gamma), and highlights. | **Channel** (Segmented: RGB, Red, Green, Blue)<br>**Levels** (Levels Editor) |
| **Curves** | Precise histogram adjustments using a custom spline over RGB or individual color channels. | **Channel** (Segmented: RGB, Red, Green, Blue)<br>**Curve** (Curves Editor) |
| **Selective Color** | Targets specific color ranges to adjust their CMYK mix, similar to a print-color-correction process. | **Colors** (Select Family)<br>**Cyan, Magenta, Yellow, Black** (Sliders: -100% - 100%)<br>**Mode** (Segmented: Relative, Absolute) |

## 🖌️ Stylization & Generative Art
Effects that fundamentally alter the visual representation into artistic motifs like ASCII, halftone, or cellular growth.

| Effect | Description | Controls |
| :--- | :--- | :--- |
| **ASCII Art** | Renders the image as text characters corresponding to underlying source luminance. | **Preset** (Select)<br>**Characters** (Text Input)<br>**Scale** (Slider: 0-100)<br>**Gamma** (Slider: 0-100)<br>**Phase** (Slider: 0-100)<br>**Line Height** (Slider: 50-200%)<br>**Letter Spacing** (Slider: -50-200%)<br>**Font** (Select)<br>**Color Mode** (Segmented: Texture, Grayscale, Mono)<br>**Background** (Checkbox)<br>**Remove BG v2** (Checkbox)<br>**Background Color** (Color)<br>**Text Color** (Color)<br>**Invert** (Checkbox) |
| **Dithering** | Reduces color palette mapping continuous tones into patterns using thresholding mechanisms. | **Enable Effect** (Checkbox)<br>**Pattern** (Segmented: F-S, Bayer, Random)<br>**Threshold** (Slider: 0-255)<br>**Pixel Size** (Slider: 1-20)<br>**Use Original Colors** (Checkbox)<br>**Palette Mode** (Segmented: Mono, Duo, Tri)<br>**Remove BG v2** (Checkbox)<br>**Shadows, Midtones, Highlights** (Color)<br>**Image Preprocessing** (Checkbox)<br> *[Pre-Blur, Pre-Grain, Gamma Factor, Black Point, White Point]* |
| **Stippling** | Creates a particle-like stipple field that distorts local textures around dot centers. | **Density** (Slider: 8-180)<br>**Distortion** (Slider: 0-0.08)<br>**Jitter** (Slider: 0.0-1.0)<br>**Dot Size** (Slider: 0.1-1.0)<br>**Hardness** (Slider: 0.2-8.0)<br>**Seed** (Slider: 0-10000)<br>**Quality** (Segmented: Low, Medium, High) |
| **Cellular Automata** | Runs neighborhood simulation rules (like Game of Life) based on thresholded image luminance. | **Threshold** (Slider: 0-255)<br>**Cell Size** (Slider: 1-32)<br>**Steps** (Slider: 1-10)<br>**Type** (Segmented: Classic, LTL, MNCAB, MNCC)<br>**MNCA Threshold 1 / 2** (Sliders: 0.0-1.0) |

## 📐 Filters & Convolutions
Classic kernel convolutions, blurring, sharpening, noise injections, and metric distortions.

| Effect | Description | Controls |
| :--- | :--- | :--- |
| **Unsharp Mask** | Sharpens image edges by subtracting a blurred version of the image from the original. | **Amount** (Slider: 0-500%)<br>**Radius** (Slider: 0.1-20px)<br>**Threshold** (Slider: 0-255) |
| **Find Edges** | Highlights rapid changes in luminance to produce a line-art or sketch-like outline effect. | *(No controls)* |
| **Minimum (Erode)** | Erosive morphological filter shrinking bright regions by replacing pixels with the darkest neighbor. | **Radius** (Slider: 0.1-20px)<br>**Preserve** (Segmented: Roundness, Squareness) |
| **Add Noise** | Superimposes artificial grain across the image using uniform or gaussian statistical distributions. | **Amount** (Slider: 0-100%)<br>**Distribution** (Segmented: Uniform, Gaussian)<br>**Monochromatic** (Checkbox)<br>**Seed** (Slider: 0-10000) |
| **Ripple** | Applies a sinus-based UV mapping distortion simulating water ripples across the texture. | **Amount** (Slider: -100% - 100%)<br>**Size** (Segmented: Small, Medium, Large) |
