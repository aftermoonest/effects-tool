import { useEffect, useRef } from 'react';
import { LayerTree } from '@/components/LayerTree';
import { EffectsPanel } from '@/components/EffectsPanel';
import { CanvasViewport } from '@/components/CanvasViewport';
import { ShortcutsPanel } from '@/components/ShortcutsPanel';
import { CanvasHeader } from '@/components/CanvasHeader';
import { useEditorStore } from '@/store/editorStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { TEMPLATE_GROUPS, loadImage } from '@/data/templateData';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutoSave } from '@/hooks/useAutoSave';

export function EditorView() {
    useKeyboardShortcuts();
    useAutoSave();
    const initializedRef = useRef(false);

    // Load a random template only for new projects with no layers
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const { layers } = useEditorStore.getState();
        if (Object.keys(layers).length > 0) return;

        const activeProjectId = useDashboardStore.getState().activeProjectId;
        // Only auto-load template if this is a brand new project
        if (!activeProjectId) return;

        (async () => {
            try {
                const randomTemplate = TEMPLATE_GROUPS[Math.floor(Math.random() * TEMPLATE_GROUPS.length)];
                const [bgImg, overlayImg] = await Promise.all([
                    loadImage(randomTemplate.bgUrl),
                    loadImage(randomTemplate.overlayUrl, false),
                ]);
                useEditorStore.getState().applyTemplate(bgImg, overlayImg, randomTemplate.name);
            } catch (error) {
                console.warn('[EditorView] Failed to load random template', error);
            }
        })();
    }, []);

    return (
        <div className="w-screen h-screen flex flex-col overflow-hidden bg-background text-foreground">
            <CanvasHeader />
            <main className="flex-1 flex overflow-hidden">
                <LayerTree />
                <CanvasViewport />
                <EffectsPanel />
            </main>
            <ShortcutsPanel />
        </div>
    );
}
