"use client";

import React from "react";
import Select, { SingleValue } from "react-select";
import { SelectOption } from "./creatable-select";

interface SearchableSelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabledIds?: string[];
}

export function SearchableSelectInput({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  disabledIds = [],
}: SearchableSelectInputProps) {
  const selectedOption = options.find((opt) => opt.value === value) || null;

  const handleChange = (newValue: SingleValue<SelectOption>) => {
    if (newValue) {
      onChange(newValue.value);
    } else {
      onChange("");
    }
  };

  return (
    <Select
      value={selectedOption}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      className="text-sm"
      isOptionDisabled={(option) => disabledIds.includes(option.value) && option.value !== value}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: "44px",
          height: "44px",
          borderRadius: "0.5rem",
          borderColor: state.isFocused ? "#E65F2B" : "#e2e8f0",
          boxShadow: state.isFocused ? "0 0 0 1px #E65F2B" : "none",
          backgroundColor: "rgb(248 250 252 / 0.5)",
          "&:hover": {
            borderColor: state.isFocused ? "#E65F2B" : "#cbd5e1",
          },
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isDisabled
            ? "transparent"
            : state.isSelected
            ? "rgb(248 250 252)"
            : state.isFocused
            ? "rgb(241 245 249)"
            : "white",
          color: state.isDisabled
            ? "#cbd5e1"
            : state.isSelected
            ? "black"
            : "#334155",
          cursor: state.isDisabled ? "not-allowed" : "pointer",
          "&:active": {
            backgroundColor: state.isDisabled ? "transparent" : "rgb(241 245 249)",
          },
        }),
      }}
    />
  );
}
