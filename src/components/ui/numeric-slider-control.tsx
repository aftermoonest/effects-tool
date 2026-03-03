import { NumberInput } from './number-input';
import { Slider } from './slider';

interface NumericSliderControlProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (value: number) => void;
}

export const NumericSliderControl = ({
    label,
    value,
    min,
    max,
    step,
    unit,
    onChange,
}: NumericSliderControlProps) => {
    return (
        <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-mono uppercase truncate mr-2">{label}</span>
                <NumberInput
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    unit={unit}
                    onChange={onChange}
                    className="w-20 min-w-0"
                    inputClassName="font-mono text-primary"
                />
            </div>
            <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
        </div>
    );
};
