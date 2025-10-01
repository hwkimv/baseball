import * as React from "react";

type SliderProps = {
    value: number[];
    min?: number;
    max?: number;
    step?: number;
    onValueChange?: (v: number[]) => void;
    className?: string;
};

export function Slider({
                           value,
                           min = 0,
                           max = 100,
                           step = 1,
                           onValueChange,
                           className = "",
                       }: SliderProps) {
    const v = value?.[0] ?? 0;
    return (
        <div className={`w-full ${className}`}>
            <input
                type="range"
                value={v}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onValueChange?.([Number(e.target.value)])}
                className="w-full accent-emerald-500"
            />
        </div>
    );
}
