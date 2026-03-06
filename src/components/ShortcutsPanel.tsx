import { X } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { SHORTCUTS, CATEGORY_ORDER } from '@/data/keyboardShortcuts';
import { useMemo } from 'react';

export const ShortcutsPanel = () => {
    const open = useEditorStore((s) => s.shortcutsPanelOpen);
    const close = () => useEditorStore.getState().setShortcutsPanelOpen(false);

    const grouped = useMemo(
        () =>
            CATEGORY_ORDER.map((cat) => ({
                category: cat,
                shortcuts: SHORTCUTS.filter((s) => s.category === cat),
            })).filter((g) => g.shortcuts.length > 0),
        [],
    );

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={close}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div
                className="relative z-10 w-full max-w-lg max-h-[85vh] mx-4 flex flex-col bg-card border border-border overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30 shrink-0">
                    <h2 className="text-xs font-bold uppercase tracking-widest">Keyboard Shortcuts</h2>
                    <button onClick={close} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-2">
                    {grouped.map(({ category, shortcuts }) => (
                        <div key={category}>
                            <div className="px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/20">
                                {category}
                            </div>
                            {shortcuts.map((s) => (
                                <div key={s.id} className="flex justify-between items-center px-6 py-1.5">
                                    <span className="text-xs text-foreground">{s.label}</span>
                                    <kbd className="inline-flex items-center px-1.5 py-0.5 bg-secondary border border-border rounded text-[10px] font-mono min-w-[24px] justify-center">
                                        {s.keyDisplay}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
