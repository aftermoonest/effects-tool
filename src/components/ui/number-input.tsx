import { ChevronUp, ChevronDown } from "lucide-react";
import * as React from "react";
import { useState, useEffect } from "react";

interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    unit?: string;
    className?: string; // wrapper class
    inputClassName?: string;
}

export function NumberInput({
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 1,
    label,
    unit,
    className = "",
    inputClassName = "",
}: NumberInputProps) {
    const formatValue = (v: number) => {
        if (isNaN(v)) return "";
        return String(Number(v.toFixed(3)));
    };

    const [inputValue, setInputValue] = useState<string>(formatValue(value));

    useEffect(() => {
        setInputValue(formatValue(value));
    }, [value]);

    const handleIncrement = (e: React.MouseEvent | React.KeyboardEvent) => {
        const delta = e.shiftKey ? step * 10 : step;
        const current = isNaN(Number(inputValue)) ? (value || 0) : Number(inputValue);
        const next = Math.max(min, Math.min(max, current + delta));
        setInputValue(formatValue(next));
        onChange(next);
    };

    const handleDecrement = (e: React.MouseEvent | React.KeyboardEvent) => {
        const delta = e.shiftKey ? step * 10 : step;
        const current = isNaN(Number(inputValue)) ? (value || 0) : Number(inputValue);
        const next = Math.max(min, Math.min(max, current - delta));
        setInputValue(formatValue(next));
        onChange(next);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (e.target.value === '' || e.target.value === '-') return;

        const next = Number(e.target.value);
        if (!isNaN(next)) {
            onChange(next);
        }
    };

    const handleBlur = () => {
        if (inputValue === '' || inputValue === '-') {
            setInputValue(formatValue(value));
            return;
        }
        const next = Number(inputValue);
        if (!isNaN(next)) {
            const clamped = Math.max(min, Math.min(max, next));
            setInputValue(formatValue(clamped));
            onChange(clamped);
        } else {
            // Revert on invalid input
            setInputValue(formatValue(value));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleIncrement(e);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleDecrement(e);
        } else if (e.key === 'Enter') {
            handleBlur();
        }
    };

    return (
        <div className={`flex items-stretch bg-secondary/50 border border-border rounded focus-within:ring-1 focus-within:ring-primary focus-within:border-primary overflow-hidden ${className}`}>
            {label && (
                <div className="flex items-center pl-2 shrink-0">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold w-3">{label}</label>
                </div>
            )}
            <input
                type="text"
                inputMode="decimal"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                aria-label={label || undefined}
                className={`flex-1 min-w-0 bg-transparent border-none py-1 focus:outline-none tabular-nums text-right text-foreground text-xs px-2 ${inputClassName}`}
            />
            {unit && (
                <div className="flex items-center pr-2 shrink-0 pointer-events-none">
                    <span className="text-xs text-muted-foreground">{unit}</span>
                </div>
            )}
            <div className="flex flex-col border-l border-border bg-card shrink-0">
                <button
                    type="button"
                    onClick={handleIncrement}
                    className="flex-1 px-1.5 flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronUp size={12} strokeWidth={3} />
                </button>
                <div className="h-[1px] bg-border" />
                <button
                    type="button"
                    onClick={handleDecrement}
                    className="flex-1 px-1.5 flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronDown size={12} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
}
