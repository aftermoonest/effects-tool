export interface ShortcutDef {
    id: string;
    key: string;
    keyDisplay: string;
    modifiers?: { meta?: boolean; shift?: boolean };
    label: string;
    category: 'Layer' | 'Effects' | 'Edit' | 'Canvas' | 'Transform' | 'General';
}

export const CATEGORY_ORDER = ['Layer', 'Effects', 'Edit', 'Canvas', 'Transform', 'General'] as const;

export const SHORTCUTS: ShortcutDef[] = [
    // Layer
    { id: 'add-image',       key: 'i',         keyDisplay: 'I',      label: 'Add image layer',         category: 'Layer' },
    { id: 'add-adjustment',  key: 'j',         keyDisplay: 'J',      label: 'Add adjustment layer',    category: 'Layer' },
    { id: 'add-group',       key: 'g',         keyDisplay: 'G',      label: 'Add group',               category: 'Layer' },
    { id: 'add-mask',        key: 'm',         keyDisplay: 'M',      label: 'Add mask layer',          category: 'Layer' },
    { id: 'add-solid',       key: 'k',         keyDisplay: 'K',      label: 'Add solid color layer',   category: 'Layer' },
    { id: 'duplicate-layer', key: 'd',         keyDisplay: '⌘D',     label: 'Duplicate layer',         category: 'Layer', modifiers: { meta: true } },
    { id: 'delete-layer',    key: 'Delete',    keyDisplay: 'Del',    label: 'Delete layer',            category: 'Layer' },
    { id: 'toggle-vis',      key: 'v',         keyDisplay: 'V',      label: 'Toggle layer visibility', category: 'Layer' },
    { id: 'next-layer',      key: 'Tab',       keyDisplay: 'Tab',    label: 'Select next layer',       category: 'Layer' },
    { id: 'prev-layer',      key: 'Tab',       keyDisplay: '⇧Tab',   label: 'Select previous layer',   category: 'Layer', modifiers: { shift: true } },

    // Effects
    { id: 'open-effects',    key: 'e',         keyDisplay: 'E',      label: 'Open effects dropdown',   category: 'Effects' },
    { id: 'delete-effect',   key: 'Delete',    keyDisplay: '⇧Del',   label: 'Delete active effect',    category: 'Effects', modifiers: { shift: true } },

    // Edit
    { id: 'undo',            key: 'z',         keyDisplay: '⌘Z',     label: 'Undo',                    category: 'Edit', modifiers: { meta: true } },
    { id: 'redo',            key: 'z',         keyDisplay: '⌘⇧Z',    label: 'Redo',                    category: 'Edit', modifiers: { meta: true, shift: true } },

    // Canvas
    { id: 'zoom-in',         key: '=',         keyDisplay: '+',      label: 'Zoom in',                 category: 'Canvas' },
    { id: 'zoom-out',        key: '-',         keyDisplay: '−',      label: 'Zoom out',                category: 'Canvas' },
    { id: 'fit-screen',      key: '0',         keyDisplay: '0',      label: 'Fit to screen',           category: 'Canvas' },
    { id: 'reset-zoom',      key: '1',         keyDisplay: '1',      label: 'Reset zoom (100%)',       category: 'Canvas' },
    { id: 'export',          key: 'e',         keyDisplay: '⌘⇧E',    label: 'Export image',            category: 'Canvas', modifiers: { meta: true, shift: true } },
    { id: 'templates',       key: 't',         keyDisplay: 'T',      label: 'Open templates',          category: 'Canvas' },
    { id: 'pan-mode',        key: 'Space',     keyDisplay: 'Space',  label: 'Pan mode (hold)',         category: 'Canvas' },

    // Transform
    { id: 'nudge',           key: 'Arrow',     keyDisplay: '←↑↓→',   label: 'Nudge layer (1px)',       category: 'Transform' },
    { id: 'nudge-big',       key: 'Arrow',     keyDisplay: '⇧←↑↓→',  label: 'Nudge layer (10px)',      category: 'Transform', modifiers: { shift: true } },

    // General
    { id: 'shortcuts-panel', key: '?',         keyDisplay: '?',      label: 'Show keyboard shortcuts', category: 'General' },
    { id: 'escape',          key: 'Escape',    keyDisplay: 'Esc',    label: 'Close panel / Deselect',  category: 'General' },
];
