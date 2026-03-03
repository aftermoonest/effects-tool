import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { NumericSliderControl } from './numeric-slider-control';

const meta = {
    title: 'UI/NumericSliderControl',
    component: NumericSliderControl,
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <div className="w-64">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof NumericSliderControl>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        label: 'Brightness',
        value: 0,
        min: -1,
        max: 1,
        step: 0.01,
        onChange: () => { },
    },
};

export const Opacity: Story = {
    args: {
        label: 'Opacity',
        value: 0.75,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: () => { },
    },
};

export const LargeRange: Story = {
    args: {
        label: 'Radius',
        value: 5,
        min: 1,
        max: 100,
        step: 1,
        onChange: () => { },
    },
};

/** Drag slider or edit the number input directly */
export const Interactive: Story = {
    args: { label: 'Brightness', value: 0, min: -1, max: 1, step: 0.01, onChange: () => { } },
    render: () => {
        const [brightness, setBrightness] = useState(0);
        const [contrast, setContrast] = useState(0);
        const [opacity, setOpacity] = useState(1);
        return (
            <div className="w-64 space-y-1">
                <NumericSliderControl label="Brightness" value={brightness} min={-1} max={1} step={0.01} onChange={setBrightness} />
                <NumericSliderControl label="Contrast" value={contrast} min={-1} max={1} step={0.01} onChange={setContrast} />
                <NumericSliderControl label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} />
            </div>
        );
    },
};
