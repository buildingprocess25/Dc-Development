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
  className?: string;
  menuPortalTarget?: HTMLElement | null;
  maxMenuHeight?: number;
  controlHeight?: number | string;
  fontSize?: string;
}

export function SearchableSelectInput({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  disabledIds = [],
  className,
  menuPortalTarget,
  maxMenuHeight = 280,
  controlHeight = 44,
  fontSize,
}: SearchableSelectInputProps) {
  const selectedOption =
    options.find((opt) => opt.value === value) ||
    options.find(
      (opt) =>
        Boolean(value) &&
        opt.value.trim().toUpperCase() === value.trim().toUpperCase()
    ) ||
    null;

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
      className={className || "text-sm"}
      isOptionDisabled={(option) => disabledIds.includes(option.value) && option.value !== value}
      menuPortalTarget={menuPortalTarget}
      menuPosition={menuPortalTarget ? "fixed" : "absolute"}
      menuPlacement="auto"
      maxMenuHeight={maxMenuHeight}
      styles={{
        menuPortal: (base) => ({
          ...base,
          zIndex: 99999,
        }),
        menu: (base) => ({
          ...base,
          zIndex: 9999,
          boxShadow:
            "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }),
        menuList: (base) => ({
          ...base,
          maxHeight: `${maxMenuHeight}px`,
          overflowY: "auto",
          padding: "4px",
          "::-webkit-scrollbar": {
            width: "8px",
          },
          "::-webkit-scrollbar-track": {
            background: "#f1f5f9",
            borderRadius: "4px",
          },
          "::-webkit-scrollbar-thumb": {
            background: "#cbd5e1",
            borderRadius: "4px",
          },
          "::-webkit-scrollbar-thumb:hover": {
            background: "#94a3b8",
          },
        }),
        control: (base, state) => ({
          ...base,
          minHeight: typeof controlHeight === "number" ? `${controlHeight}px` : (controlHeight || "44px"),
          height: typeof controlHeight === "number" ? `${controlHeight}px` : (controlHeight || "44px"),
          borderRadius: "0.5rem",
          borderColor: state.isFocused ? "#E65F2B" : "#e2e8f0",
          boxShadow: state.isFocused ? "0 0 0 1px #E65F2B" : "none",
          backgroundColor: "rgb(248 250 252 / 0.5)",
          fontSize: fontSize || "0.75rem",
          "&:hover": {
            borderColor: state.isFocused ? "#E65F2B" : "#cbd5e1",
          },
        }),
        valueContainer: (base) => ({
          ...base,
          padding:
            controlHeight &&
            (typeof controlHeight === "number"
              ? controlHeight < 40
              : parseInt(String(controlHeight), 10) < 40)
              ? "0 8px"
              : base.padding,
        }),
        indicatorsContainer: (base) => ({
          ...base,
          height: typeof controlHeight === "number" ? `${controlHeight}px` : (controlHeight || "44px"),
        }),
        dropdownIndicator: (base) => ({
          ...base,
          padding:
            controlHeight &&
            (typeof controlHeight === "number"
              ? controlHeight < 40
              : parseInt(String(controlHeight), 10) < 40)
              ? "4px"
              : base.padding,
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
            ? "#94a3b8"
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
