import type { Meta, StoryObj } from '@storybook/react-vite';
import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
} from './context-menu';
import { Copy, Trash2, Pencil, Eye } from 'lucide-react';

const meta = {
    title: 'UI/ContextMenu',
    component: ContextMenu,
    tags: ['autodocs'],
} satisfies Meta<typeof ContextMenu>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <ContextMenu>
            <ContextMenuTrigger>
                <div className="flex items-center justify-center w-64 h-32 border border-dashed border-border text-muted-foreground text-xs font-mono uppercase">
                    Right-click here
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem>Cut</ContextMenuItem>
                <ContextMenuItem>Copy</ContextMenuItem>
                <ContextMenuItem>Paste</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem>Delete</ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    ),
};

export const LayerActions: Story = {
    render: () => (
        <ContextMenu>
            <ContextMenuTrigger>
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border border-border text-foreground text-xs font-mono uppercase w-64">
                    <span className="text-primary">■</span> Layer 1
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem className="gap-2">
                    <Pencil size={14} /> Rename
                </ContextMenuItem>
                <ContextMenuItem className="gap-2">
                    <Copy size={14} /> Duplicate
                </ContextMenuItem>
                <ContextMenuItem className="gap-2">
                    <Eye size={14} /> Toggle Visibility
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem className="gap-2 text-destructive">
                    <Trash2 size={14} /> Delete Layer
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    ),
};
