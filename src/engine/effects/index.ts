// Barrel file — importing this module registers all built-in effects.
import { effectRegistry } from '../effectRegistry';

// Color Adjustments
import { brightnessContrast, blackWhite, levels, curves, selectiveColor } from './colorAdjustments';

// Filters
import { unsharpMask, addNoise, ripple, minimum, findEdges } from './filters';

// Stylize
import { dithering, ascii } from './stylize';

// Register all built-in effects
const allEffects = [
    brightnessContrast,
    blackWhite,
    levels,
    curves,
    selectiveColor,
    unsharpMask,
    addNoise,
    ripple,
    minimum,
    findEdges,
    dithering,
    ascii,
];

for (const effect of allEffects) {
    effectRegistry.register(effect);
}

export { allEffects };
