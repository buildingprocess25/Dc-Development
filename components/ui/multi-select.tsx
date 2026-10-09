"use client";

import React from "react";
import Select, { MultiValue } from "react-select";
import { SelectOption } from "./creatable-select";

interface MultiSelectInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabledIds?: string[];
}

export function MultiSelectInput({
  value,
  onChange,
  options,
  placeholder = "Pilih beberapa...",
  disabledIds = [],
}: MultiSelectInputProps) {
  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const handleChange = (newValues: MultiValue<SelectOption>) => {
    if (newValues) {
      onChange(newValues.map((v) => v.value));
    } else {
      onChange([]);
    }
  };

  return (
    <Select
      isMulti
      value={selectedOptions}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      className="text-sm"
      isOptionDisabled={(option) => disabledIds.includes(option.value) && !value.includes(option.value)}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: "44px",
          borderRadius: "0.5rem",
          borderColor: state.isFocused ? "#E65F2B" : "#e2e8f0",
          boxShadow: state.isFocused ? "0 0 0 1px #E65F2B" : "none",
          backgroundColor: "rgb(248 250 252 / 0.5)",
          "&:hover": {
            borderColor: state.isFocused ? "#E65F2B" : "#cbd5e1",
          },
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: "rgb(241 245 249)", // slate-100
          borderRadius: "0.25rem",
        }),
        multiValueLabel: (base) => ({
          ...base,
          color: "rgb(51 65 85)", // slate-700
          fontSize: "12px",
          fontWeight: 600,
        }),
        multiValueRemove: (base) => ({
          ...base,
          color: "rgb(148 163 184)", // slate-400
          ":hover": {
            backgroundColor: "rgb(254 226 226)", // red-100
            color: "rgb(239 68 68)", // red-500
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
