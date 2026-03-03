import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { NumberInput } from './number-input';

const meta = {
    title: 'UI/NumberInput',
    component: NumberInput,
    tags: ['autodocs'],
    argTypes: {
        value: { control: 'number' },
        min: { control: 'number' },
        max: { control: 'number' },
        step: { control: 'number' },
        label: { control: 'text' },
    },
    decorators: [
        (Story) => (
            <div className="w-48">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof NumberInput>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { value: 100, onChange: () => { } },
};

export const WithLabel: Story = {
    args: { value: 1920, label: 'W', onChange: () => { } },
};

export const WithMinMax: Story = {
    args: { value: 50, min: 0, max: 100, label: 'X', onChange: () => { } },
};

export const SmallStep: Story = {
    args: { value: 0.5, step: 0.01, min: 0, max: 1, label: 'A', onChange: () => { } },
};

/** Hold Shift while clicking arrows or pressing Arrow keys to increment/decrement by 10× */
export const Interactive: Story = {
    args: { value: 100, onChange: () => { } },
    render: () => {
        const [val, setVal] = useState(100);
        return (
            <div className="space-y-3">
                <NumberInput value={val} onChange={setVal} label="W" min={0} max={9999} step={1} />
                <p className="text-xs text-muted-foreground font-mono">
                    Value: {val} — Hold <kbd className="px-1 py-0.5 bg-secondary border border-border text-[10px]">Shift</kbd> for ×10
                </p>
            </div>
        );
    },
};

export const AllVariants: Story = {
    args: { value: 0, onChange: () => { } },
    render: () => {
        const [w, setW] = useState(1920);
        const [h, setH] = useState(1080);
        const [opacity, setOpacity] = useState(0.75);
        return (
            <div className="space-y-3 w-48">
                <NumberInput value={w} onChange={setW} label="W" min={1} max={7680} />
                <NumberInput value={h} onChange={setH} label="H" min={1} max={4320} />
                <NumberInput value={opacity} onChange={setOpacity} label="α" min={0} max={1} step={0.01} />
            </div>
        );
    },
};
