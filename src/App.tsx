import { useEffect, useRef } from 'react';
import { LayerTree } from '@/components/LayerTree';
import { EffectsPanel } from '@/components/EffectsPanel';
import { CanvasViewport } from '@/components/CanvasViewport';
import { useEditorStore } from '@/store/editorStore';

import { CanvasHeader } from '@/components/CanvasHeader';

const DEFAULT_IMAGE_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop';

function App() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const { layers, addImageLayer } = useEditorStore.getState();
    if (Object.keys(layers).length === 0) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        addImageLayer(img, 'Default Image');
      };
      img.src = DEFAULT_IMAGE_URL;
    }
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-background text-foreground">

      <CanvasHeader />

      {/* Main Workspace: 3-column layout */}
      <main className="flex-1 flex overflow-hidden">
        <LayerTree />
        <CanvasViewport />
        <EffectsPanel />
      </main>

    </div>
  );
}

export default App;
