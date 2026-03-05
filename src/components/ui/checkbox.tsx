import { Check } from 'lucide-react';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    className?: string;
}

export const Checkbox = ({ checked, onChange, label, className = '' }: CheckboxProps) => (
    <label
        className={`flex items-center gap-2.5 py-1.5 px-2 -mx-2 cursor-pointer hover:bg-secondary/20 transition-colors select-none group ${className}`}
    >
        <div
            className={`relative flex items-center justify-center w-4 h-4 border shrink-0 transition-colors ${
                checked
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/40 bg-secondary/50 group-hover:border-muted-foreground/60'
            }`}
        >
            {checked && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
        </div>
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
        />
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
            {label}
        </span>
    </label>
);
