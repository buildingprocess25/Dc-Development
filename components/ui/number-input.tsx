"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "prefix"> {
  value: number | string | "";
  onChange: (value: number | "") => void;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  containerClassName?: string;
}

/**
 * Reusable NumberInput component that completely disables mouse wheel / touchpad
 * scrolling number increments and hides browser native spin buttons.
 */
export function NumberInput({
  value,
  onChange,
  suffix,
  prefix,
  className,
  containerClassName,
  disabled,
  placeholder = "0",
  min,
  max,
  step,
  ...props
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      onChange("");
    } else {
      const num = parseFloat(val);
      onChange(isNaN(num) ? "" : num);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // Prevent mouse wheel / touchpad scroll from changing the value
    e.currentTarget.blur();
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        "relative flex items-center rounded-xl border border-slate-200 bg-white transition-all focus-within:border-[#E65F2B] focus-within:ring-2 focus-within:ring-[#E65F2B]/20",
        disabled && "opacity-50 cursor-not-allowed bg-slate-50",
        containerClassName
      )}
    >
      {prefix && (
        <span className="pl-3 text-xs font-semibold text-slate-400 select-none">
          {prefix}
        </span>
      )}

      <input
        type="number"
        value={value}
        onChange={handleChange}
        onWheel={handleWheel}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={cn(
          "w-full bg-transparent px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          prefix && "pl-1.5",
          suffix && "pr-1.5",
          className
        )}
        {...props}
      />

      {suffix && (
        <span className="pr-3 text-[11px] font-bold tracking-wider text-slate-400 select-none uppercase">
          {suffix}
        </span>
      )}
    </div>
  );
}
