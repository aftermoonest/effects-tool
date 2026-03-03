import { effectRegistry } from '../effectRegistry';

import { brightnessContrast } from './brightnessContrast';
import { blackWhite } from './blackWhite';
import { levels } from './levels';
import { curves } from './curves';
import { selectiveColor } from './selectiveColor';
import { unsharpMask } from './unsharpMask';
import { addNoise } from './addNoise';
import { ripple } from './ripple';
import { minimum } from './minimum';
import { findEdges } from './findEdges';
import { ascii } from './ascii';
import { dithering } from './dithering';
import { stippling } from './stippling';
import { cellularAutomata } from './cellularAutomata';

export function registerAllEffects() {
    effectRegistry.register(brightnessContrast);
    effectRegistry.register(blackWhite);
    effectRegistry.register(levels);
    effectRegistry.register(curves);
    effectRegistry.register(selectiveColor);

    effectRegistry.register(unsharpMask);
    effectRegistry.register(addNoise);
    effectRegistry.register(ripple);
    effectRegistry.register(minimum);
    effectRegistry.register(findEdges);

    effectRegistry.register(ascii);
    effectRegistry.register(dithering);
    effectRegistry.register(stippling);
    effectRegistry.register(cellularAutomata);
}

// Automatically register all effects when this module is imported.
registerAllEffects();
