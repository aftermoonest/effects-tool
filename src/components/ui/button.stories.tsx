import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Plus, Download, Trash2 } from 'lucide-react';

const meta = {
    title: 'UI/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg', 'icon'],
        },
        disabled: { control: 'boolean' },
    },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { children: 'Button' },
};

export const Destructive: Story = {
    args: { variant: 'destructive', children: 'Delete' },
};

export const Outline: Story = {
    args: { variant: 'outline', children: 'Outline' },
};

export const Secondary: Story = {
    args: { variant: 'secondary', children: 'Secondary' },
};

export const Ghost: Story = {
    args: { variant: 'ghost', children: 'Ghost' },
};

export const Link: Story = {
    args: { variant: 'link', children: 'Link' },
};

export const Small: Story = {
    args: { size: 'sm', children: 'Small' },
};

export const Large: Story = {
    args: { size: 'lg', children: 'Large' },
};

export const Icon: Story = {
    args: { size: 'icon', children: <Plus size={16} /> },
};

export const WithIcon: Story = {
    args: {
        children: (
            <>
                <Download size={14} />
                Export
            </>
        ),
    },
    render: (args) => <Button {...args} className="gap-2" />,
};

export const Disabled: Story = {
    args: { children: 'Disabled', disabled: true },
};

export const DestructiveIcon: Story = {
    args: {
        variant: 'destructive',
        children: (
            <>
                <Trash2 size={14} />
                Remove
            </>
        ),
    },
    render: (args) => <Button {...args} className="gap-2" />,
};

export const AllVariants: Story = {
    render: () => (
        <div className="flex flex-wrap gap-3 items-center">
            <Button variant="default">Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
        </div>
    ),
};

export const AllSizes: Story = {
    render: () => (
        <div className="flex items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon"><Plus size={16} /></Button>
        </div>
    ),
};
