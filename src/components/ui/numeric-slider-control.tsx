import { useState, useRef, useEffect } from 'react';
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

const formatDisplay = (value: number, step: number, unit?: string): string => {
    const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
    const formatted = value.toFixed(decimals);
    return unit ? `${formatted}${unit}` : formatted;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const NumericSliderControl = ({
    label,
    value,
    min,
    max,
    step,
    unit,
    onChange,
}: NumericSliderControlProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const startEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditValue(String(value));
        setIsEditing(true);
    };

    const commitEdit = () => {
        const parsed = parseFloat(editValue);
        if (!isNaN(parsed)) {
            onChange(clamp(parsed, min, max));
        }
        setIsEditing(false);
    };

    const displayValue = formatDisplay(value, step, unit);

    return (
        <div className="relative">
            <Slider
                value={[value]}
                min={min}
                max={max}
                step={step}
                onValueChange={(v) => onChange(v[0])}
            />
            <div className="absolute inset-0 flex items-center pointer-events-none px-2.5 z-10">
                <span className="text-[10px] text-muted-foreground font-mono uppercase truncate mr-2">
                    {label}
                </span>
                <span className="ml-auto">
                    {isEditing ? (
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                            className="pointer-events-auto w-16 h-5 bg-background border border-primary px-1.5 text-[10px] font-mono text-foreground text-right focus:outline-none"
                        />
                    ) : (
                        <span
                            className="pointer-events-auto text-[10px] font-bold font-mono tabular-nums text-foreground cursor-text hover:text-primary transition-colors"
                            onDoubleClick={startEditing}
                        >
                            {displayValue}
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
};
