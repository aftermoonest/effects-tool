import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Layer } from '@/store/editorStore';
import { isTextInputTarget } from '@/lib/utils';

const MIN_LAYER_SIZE = 8;

const getFlatLayerIds = (layers: Record<string, Layer>, layerOrder: string[]): string[] => {
    const ids: string[] = [];
    const walk = (order: string[]) => {
        for (const id of order) {
            const layer = layers[id];
            if (!layer) continue;
            ids.push(id);
            if (layer.kind === 'group' && !layer.collapsed && layer.children.length > 0) {
                walk(layer.children);
            }
        }
    };
    walk(layerOrder);
    return ids;
};

const handleExport = () => {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
    if (!canvas || canvas.width <= 1 || canvas.height <= 1) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.download = `effects-export-${timestamp}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

export function useKeyboardShortcuts() {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isTextInputTarget(e.target)) return;

            const s = useEditorStore.getState();

            // When shortcuts panel is open, only Escape works
            if (s.shortcutsPanelOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    s.setShortcutsPanelOpen(false);
                }
                return;
            }

            const key = e.key.toLowerCase();
            const isMod = e.metaKey || e.ctrlKey;

            // --- Modifier combos ---
            if (isMod && key === 's') {
                e.preventDefault();
                useDashboardStore.getState().saveCurrentProject();
                return;
            }
            if (isMod && e.shiftKey && key === 'z') {
                e.preventDefault();
                if (s.transformRedoStack.length > 0) {
                    s.redoTransform();
                } else {
                    s.redoLayerAction();
                }
                return;
            }
            if (isMod && key === 'z') {
                e.preventDefault();
                if (s.transformUndoStack.length > 0) {
                    s.undoTransform();
                } else {
                    s.undoLayerAction();
                }
                return;
            }
            if (isMod && key === 'y') {
                e.preventDefault();
                if (s.transformRedoStack.length > 0) {
                    s.redoTransform();
                } else {
                    s.redoLayerAction();
                }
                return;
            }
            if (isMod && key === 'd') {
                e.preventDefault();
                if (s.activeLayerId) s.duplicateLayer(s.activeLayerId);
                return;
            }
            if (isMod && e.shiftKey && key === 'e') {
                e.preventDefault();
                handleExport();
                return;
            }

            // Shift+Delete → delete active effect
            if (e.key === 'Delete' && e.shiftKey) {
                e.preventDefault();
                if (s.activeLayerId && s.activeEffectId) {
                    s.removeEffect(s.activeLayerId, s.activeEffectId);
                }
                return;
            }

            // Delete/Backspace → delete active layer
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (s.activeLayerId) s.removeLayer(s.activeLayerId);
                return;
            }

            // Tab / Shift+Tab → cycle layers
            if (e.key === 'Tab') {
                e.preventDefault();
                const flatIds = getFlatLayerIds(s.layers, s.layerOrder);
                if (flatIds.length === 0) return;
                const currentIndex = s.activeLayerId ? flatIds.indexOf(s.activeLayerId) : -1;
                let nextIndex: number;
                if (e.shiftKey) {
                    nextIndex = currentIndex <= 0 ? flatIds.length - 1 : currentIndex - 1;
                } else {
                    nextIndex = currentIndex >= flatIds.length - 1 ? 0 : currentIndex + 1;
                }
                s.setActiveLayer(flatIds[nextIndex]);
                return;
            }

            // Don't process single-key shortcuts when modifiers are held
            if (isMod || e.altKey) return;

            // --- Single-key shortcuts ---
            switch (key) {
                case 'i':
                    e.preventDefault();
                    s.requestImageUpload();
                    break;
                case 'j':
                    e.preventDefault();
                    s.addAdjustmentLayer();
                    break;
                case 'g':
                    e.preventDefault();
                    s.addGroup();
                    break;
                case 'm':
                    e.preventDefault();
                    s.addMaskLayer();
                    break;
                case 'k':
                    e.preventDefault();
                    s.addSolidLayer(undefined, '#000000');
                    break;
                case 'e':
                    e.preventDefault();
                    if (s.activeLayerId) s.requestEffectDropdown();
                    break;
                case 'v':
                    e.preventDefault();
                    if (s.activeLayerId) s.toggleLayerVisibility(s.activeLayerId);
                    break;
                case 't':
                    e.preventDefault();
                    s.setTemplatesPanelOpen(true);
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    s.setZoom(Math.min(s.zoom * 1.25, 16));
                    break;
                case '-':
                    e.preventDefault();
                    s.setZoom(Math.max(s.zoom / 1.25, 0.05));
                    break;
                case '0': {
                    e.preventDefault();
                    const container = document.querySelector('[data-canvas-container]');
                    if (container) {
                        const rect = container.getBoundingClientRect();
                        s.fitToScreen(rect.width, rect.height);
                    }
                    break;
                }
                case '1':
                    e.preventDefault();
                    s.resetZoom();
                    break;
                case '?':
                    e.preventDefault();
                    s.setShortcutsPanelOpen(!s.shortcutsPanelOpen);
                    break;
                case 'escape':
                    e.preventDefault();
                    if (s.templatesPanelOpen) {
                        s.setTemplatesPanelOpen(false);
                    } else if (s.activeEffectId) {
                        s.setActiveEffect(null);
                    } else if (s.activeLayerId) {
                        s.setActiveLayer(null);
                    }
                    break;
            }

            // Arrow nudge
            if (!s.activeLayerId) return;
            const activeLayer = s.layers[s.activeLayerId];
            if (!activeLayer || activeLayer.kind !== 'image') return;

            const step = e.shiftKey ? 10 : 1;
            let dx = 0;
            let dy = 0;
            if (e.key === 'ArrowLeft') dx = -step;
            if (e.key === 'ArrowRight') dx = step;
            if (e.key === 'ArrowUp') dy = -step;
            if (e.key === 'ArrowDown') dy = step;

            if (dx === 0 && dy === 0) return;
            e.preventDefault();
            s.beginTransformSession();
            s.setLayerTransform(
                activeLayer.id,
                { x: activeLayer.x + dx, y: activeLayer.y + dy },
                { minSize: MIN_LAYER_SIZE },
            );
            s.commitTransformSession();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
}
