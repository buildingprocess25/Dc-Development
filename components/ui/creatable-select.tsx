"use client";

import React, { useState, useEffect } from "react";
import CreatableSelect from "react-select/creatable";
import { ActionMeta, SingleValue, components } from "react-select";

export interface SelectOption {
  value: string;
  label: string;
}

interface CreatableSelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  formatAs?: "titleCase" | "lowercase" | "none";
  className?: string;
  removeLeftRadius?: boolean;
  isClearable?: boolean;
  maxMenuHeight?: number;
}

export function CreatableSelectInput({
  value,
  onChange,
  options,
  placeholder = "Pilih atau ketik baru...",
  formatAs = "none",
  className = "",
  removeLeftRadius = false,
  isClearable = true,
  maxMenuHeight = 114,
}: CreatableSelectInputProps) {
  const selectedOption = options.find((opt) => opt.value === value) || (value ? { value, label: value } : null);

  const formatText = (text: string) => {
    if (formatAs === "lowercase") {
      return text.toLowerCase();
    }
    if (formatAs === "titleCase") {
      return text.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
      );
    }
    return text;
  };

  const [inputValue, setInputValue] = useState(value);
  const [remountKey, setRemountKey] = useState(0);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (newInputValue: string, actionMeta: any) => {
    if (actionMeta.action === "input-change") {
      setInputValue(newInputValue);
      onChange(formatText(newInputValue));
    }
  };

  const handleChange = (
    newValue: SingleValue<SelectOption>,
    actionMeta: ActionMeta<SelectOption>
  ) => {
    if (newValue) {
      const val = formatText(newValue.value);
      setInputValue(val);
      onChange(val);
    } else {
      setInputValue("");
      onChange("");
    }
    // Paksa komponen untuk meremount (refresh) agar react-select 
    // tidak menyembunyikan teks input-nya setelah dipilih
    setRemountKey(k => k + 1);
  };

  return (
    <div className={className || "w-full"}>
      <CreatableSelect
        key={remountKey}
        value={null} // Selalu null agar react-select memunculkan text input-nya (bukan chip)
        onChange={handleChange}
        options={options}
        placeholder={inputValue ? "" : placeholder}
        isClearable={isClearable}
        maxMenuHeight={maxMenuHeight}
        className="text-sm"
        inputValue={inputValue}
        onInputChange={handleInputChange}
        controlShouldRenderValue={false} // Sembunyikan chip
        components={{
          SingleValue: () => null,
          IndicatorSeparator: () => null,
        }}
        styles={{
        control: (base, state) => ({
          ...base,
          minHeight: "44px",
          height: "44px",
          borderRadius: "0.5rem",
          borderTopLeftRadius: removeLeftRadius ? 0 : "0.5rem",
          borderBottomLeftRadius: removeLeftRadius ? 0 : "0.5rem",
          borderLeftWidth: removeLeftRadius ? 0 : "1px",
          borderColor: state.isFocused ? "#E65F2B" : "#e2e8f0",
          boxShadow: state.isFocused ? "0 0 0 1px #E65F2B" : "none",
          backgroundColor: "rgb(248 250 252 / 0.5)", 
          "&:hover": {
            borderColor: state.isFocused ? "#E65F2B" : "#cbd5e1",
          },
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isSelected
            ? "rgb(248 250 252)"
            : state.isFocused
            ? "rgb(241 245 249)"
            : "white",
          color: state.isSelected ? "black" : "#334155",
          cursor: "pointer",
          "&:active": {
            backgroundColor: "rgb(241 245 249)",
          },
        }),
      }}
    />
    </div>
  );
}
