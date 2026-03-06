import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useDashboardStore } from '@/store/dashboardStore';

const AUTO_SAVE_DELAY = 3000;

export function useAutoSave() {
    useEffect(() => {
        const getActiveProjectId = () => useDashboardStore.getState().activeProjectId;
        if (!getActiveProjectId()) return;

        let debounceTimer: ReturnType<typeof setTimeout>;

        // Subscribe to editor state changes that should trigger saves
        const unsub = useEditorStore.subscribe(
            (state) => ({
                layers: state.layers,
                layerOrder: state.layerOrder,
                canvasWidth: state.canvasWidth,
                canvasHeight: state.canvasHeight,
                canvasBgColor: state.canvasBgColor,
                canvasTransparent: state.canvasTransparent,
            }),
            () => {
                // Only set unsaved if we have an active project
                if (!getActiveProjectId()) return;

                useDashboardStore.getState().setHasUnsavedChanges(true);
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    useDashboardStore.getState().saveCurrentProject();
                }, AUTO_SAVE_DELAY);
            },
        );

        // Warn on page unload
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const { hasUnsavedChanges } = useDashboardStore.getState();
            if (hasUnsavedChanges) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            unsub();
            clearTimeout(debounceTimer);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);
}
