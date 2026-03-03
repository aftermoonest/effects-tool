import type { Meta, StoryObj } from '@storybook/react-vite';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './dropdown-menu';
import { Button } from './button';
import { ChevronDown, Image, Layers, Sliders, Palette, Download } from 'lucide-react';

const meta = {
    title: 'UI/DropdownMenu',
    component: DropdownMenu,
    tags: ['autodocs'],
} satisfies Meta<typeof DropdownMenu>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                    Options <ChevronDown size={14} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem>1080p (1920×1080)</DropdownMenuItem>
                <DropdownMenuItem>Square (1080×1080)</DropdownMenuItem>
                <DropdownMenuItem>Portrait (1080×1920)</DropdownMenuItem>
                <DropdownMenuItem>4K (3840×2160)</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
};

export const WithIcons: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="gap-2">
                    Add Layer <ChevronDown size={14} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Image size={14} /> Image Layer
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Palette size={14} /> Solid Color
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Sliders size={14} /> Adjustment
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Layers size={14} /> Group
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
};

export const GhostTrigger: Story = {
    render: () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ChevronDown size={14} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem className="cursor-pointer gap-2">
                    <Download size={14} /> Export PNG
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2">
                    <Download size={14} /> Export JPEG
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    ),
};
