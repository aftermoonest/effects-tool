interface SegmentedControlProps {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}

export const SegmentedControl = ({
    value,
    options,
    onChange,
}: SegmentedControlProps) => {
    return (
        <div className="flex bg-secondary/50 p-0.5 rounded border border-border">
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`flex-1 text-[10px] font-mono py-1 rounded transition-colors ${value === option.value
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'hover:bg-secondary text-muted-foreground'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};
