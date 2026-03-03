import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Slider } from './slider';

const meta = {
    title: 'UI/Slider',
    component: Slider,
    tags: ['autodocs'],
    argTypes: {
        min: { control: 'number' },
        max: { control: 'number' },
        step: { control: 'number' },
        disabled: { control: 'boolean' },
    },
    decorators: [
        (Story) => (
            <div className="w-64">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof Slider>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: { defaultValue: [50], min: 0, max: 100, step: 1 },
};

export const Small: Story = {
    args: { defaultValue: [0.5], min: 0, max: 1, step: 0.01 },
};

export const Disabled: Story = {
    args: { defaultValue: [30], min: 0, max: 100, disabled: true },
};

/** Interactive slider showing the current value */
export const Interactive: Story = {
    render: () => {
        const [val, setVal] = useState(50);
        return (
            <div className="space-y-2 w-64">
                <Slider value={[val]} min={0} max={100} step={1} onValueChange={(v) => setVal(v[0])} />
                <p className="text-xs text-muted-foreground font-mono text-center">{val}%</p>
            </div>
        );
    },
};

export const AllRanges: Story = {
    render: () => (
        <div className="space-y-6 w-64">
            <div>
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">0–100</p>
                <Slider defaultValue={[50]} min={0} max={100} step={1} />
            </div>
            <div>
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">-1 to 1</p>
                <Slider defaultValue={[0]} min={-1} max={1} step={0.01} />
            </div>
            <div>
                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">Disabled</p>
                <Slider defaultValue={[30]} min={0} max={100} disabled />
            </div>
        </div>
    ),
};
