"use client";

/**
 * App-wide dropdown built on react-select — searchable, themed, with the menu
 * portalled to <body> so it never gets clipped by table/overflow containers.
 * Drop-in for native <select>: pass a string `value`, an options array, and an
 * onChange that receives the selected value string ("" when cleared).
 */
import ReactSelect from "react-select";

export type RSelectOption = { value: string; label: string };

export default function RSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  isClearable = false,
  isSearchable = true,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: RSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  id?: string;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <ReactSelect<RSelectOption>
      inputId={id}
      value={selected}
      onChange={(opt) => onChange(opt ? (opt as RSelectOption).value : "")}
      options={options}
      placeholder={placeholder}
      isDisabled={disabled}
      isClearable={isClearable}
      isSearchable={isSearchable}
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      menuPosition="fixed"
      classNamePrefix="rs"
      noOptionsMessage={() => "—"}
      styles={{
        control: (base, state) => ({
          ...base,
          minHeight: 36,
          borderRadius: 10,
          backgroundColor: state.isDisabled ? "var(--theme-bg-muted)" : "var(--theme-surface, #fff)",
          borderColor: state.isFocused ? "var(--theme-primary)" : "var(--theme-border-subtle)",
          boxShadow: state.isFocused ? "0 0 0 2px var(--theme-primary-tint)" : "none",
          ":hover": { borderColor: "var(--theme-primary)" },
          fontSize: 12.5,
        }),
        valueContainer: (base) => ({ ...base, paddingTop: 1, paddingBottom: 1 }),
        placeholder: (base) => ({ ...base, color: "var(--theme-text-mute)" }),
        singleValue: (base) => ({ ...base, color: "var(--theme-text)" }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        menu: (base) => ({ ...base, borderRadius: 10, overflow: "hidden", fontSize: 12.5 }),
        option: (base, state) => ({
          ...base,
          fontSize: 12.5,
          backgroundColor: state.isSelected
            ? "var(--theme-primary)"
            : state.isFocused
              ? "var(--theme-bg-muted)"
              : "transparent",
          color: state.isSelected ? "#fff" : "var(--theme-text)",
          ":active": { backgroundColor: "var(--theme-primary-tint)" },
        }),
      }}
    />
  );
}
