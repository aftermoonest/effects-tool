import { useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { EditorView } from '@/components/EditorView';

function App() {
    const currentView = useDashboardStore((s) => s.currentView);
    const loadDashboardData = useDashboardStore((s) => s.loadDashboardData);
    const [hydrated, setHydrated] = useState(useEditorStore.persist.hasHydrated());

    useEffect(() => {
        if (hydrated) return;
        const unsub = useEditorStore.persist.onFinishHydration(() => setHydrated(true));
        return unsub;
    }, [hydrated]);

    // Load dashboard data on mount
    useEffect(() => {
        if (!hydrated) return;
        loadDashboardData();
    }, [hydrated, loadDashboardData]);

    if (!hydrated) return null;

    if (currentView === 'dashboard') {
        return <Dashboard />;
    }

    return <EditorView />;
}

export default App;
