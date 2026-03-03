import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl } from './segmented-control';

const meta = {
    title: 'UI/SegmentedControl',
    component: SegmentedControl,
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <div className="w-64">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof SegmentedControl>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        value: 'RGB',
        options: [
            { value: 'RGB', label: 'RGB' },
            { value: 'R', label: 'R' },
            { value: 'G', label: 'G' },
            { value: 'B', label: 'B' },
        ],
        onChange: () => { },
    },
};

export const TwoOptions: Story = {
    args: {
        value: 'horizontal',
        options: [
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
        ],
        onChange: () => { },
    },
};

/** Click segments to switch between options */
export const Interactive: Story = {
    args: { value: 'RGB', options: [{ value: 'RGB', label: 'RGB' }], onChange: () => { } },
    render: () => {
        const [channel, setChannel] = useState('RGB');
        return (
            <div className="space-y-3 w-64">
                <SegmentedControl
                    value={channel}
                    options={[
                        { value: 'RGB', label: 'RGB' },
                        { value: 'R', label: 'R' },
                        { value: 'G', label: 'G' },
                        { value: 'B', label: 'B' },
                    ]}
                    onChange={setChannel}
                />
                <p className="text-xs text-muted-foreground font-mono">
                    Active: <span className="text-primary">{channel}</span>
                </p>
            </div>
        );
    },
};

export const BlendMode: Story = {
    args: { value: 'normal', options: [{ value: 'normal', label: 'Normal' }], onChange: () => { } },
    render: () => {
        const [mode, setMode] = useState('normal');
        return (
            <div className="w-72">
                <SegmentedControl
                    value={mode}
                    options={[
                        { value: 'normal', label: 'Normal' },
                        { value: 'multiply', label: 'Multiply' },
                        { value: 'screen', label: 'Screen' },
                    ]}
                    onChange={setMode}
                />
            </div>
        );
    },
};
