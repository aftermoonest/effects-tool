import { useEffect, useRef } from 'react';
import { LayerTree } from '@/components/LayerTree';
import { EffectsPanel } from '@/components/EffectsPanel';
import { CanvasViewport } from '@/components/CanvasViewport';
import { useEditorStore } from '@/store/editorStore';
import { TEMPLATE_GROUPS, loadImage } from '@/data/templateData';

import { CanvasHeader } from '@/components/CanvasHeader';

function App() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const { layers, applyTemplate } = useEditorStore.getState();
    if (Object.keys(layers).length === 0) {
      (async () => {
        try {
          // Pick a random template
          const randomTemplate = TEMPLATE_GROUPS[Math.floor(Math.random() * TEMPLATE_GROUPS.length)];

          const [bgImg, overlayImg] = await Promise.all([
            loadImage(randomTemplate.bgUrl),
            loadImage(randomTemplate.overlayUrl, false),
          ]);

          applyTemplate(bgImg, overlayImg, randomTemplate.name);
        } catch (error) {
          console.warn('[App] Failed to load random template', error);
        }
      })();
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
