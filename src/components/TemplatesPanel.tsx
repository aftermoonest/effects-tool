import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { TEMPLATE_GROUPS, loadImage, type TemplateGroup } from '@/data/templateData';
import { useEditorStore } from '@/store/editorStore';

interface TemplatesPanelProps {
    open: boolean;
    onClose: () => void;
}

export const TemplatesPanel = ({ open, onClose }: TemplatesPanelProps) => {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (open) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [open, handleEscape]);

    const handleApply = async (template: TemplateGroup) => {
        if (loadingId) return;
        setLoadingId(template.id);

        try {
            const [bgImg, overlayImg] = await Promise.all([
                loadImage(template.bgUrl),
                loadImage(template.overlayUrl, false),
            ]);

            const { applyTemplate } = useEditorStore.getState();
            applyTemplate(bgImg, overlayImg, template.name);
            onClose();
        } catch (err) {
            console.error('[Templates] Failed to load template:', err);
        } finally {
            setLoadingId(null);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className="relative z-10 w-full max-w-5xl max-h-[85vh] mx-4 flex flex-col bg-card border border-border overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30 shrink-0">
                    <h2 className="text-xs font-bold uppercase tracking-widest">Templates</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {TEMPLATE_GROUPS.map((template) => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                isLoading={loadingId === template.id}
                                disabled={loadingId !== null}
                                onApply={handleApply}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Template Card ──────────────────────────────────────────────────────────

interface TemplateCardProps {
    template: TemplateGroup;
    isLoading: boolean;
    disabled: boolean;
    onApply: (t: TemplateGroup) => void;
}

const TemplateCard = ({ template, isLoading, disabled, onApply }: TemplateCardProps) => {
    return (
        <button
            onClick={() => onApply(template)}
            disabled={disabled}
            className="group relative aspect-[16/10] overflow-hidden border border-border bg-secondary/20
                       transition-all duration-200 hover:border-primary hover:scale-[1.03]
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:border-border
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            {/* BG thumbnail */}
            <img
                src={template.thumbnailBg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                crossOrigin="anonymous"
            />

            {/* Overlay thumbnail */}
            <img
                src={template.overlayUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-contain mix-blend-screen"
                loading="lazy"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                {isLoading ? (
                    <Loader2 size={20} className="text-primary animate-spin" />
                ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        Apply
                    </span>
                )}
            </div>

            {/* Name label */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/80 block truncate">
                    {template.name}
                </span>
            </div>
        </button>
    );
};
