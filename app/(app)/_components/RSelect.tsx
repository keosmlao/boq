"use client";

/**
 * App-wide dropdown built on react-select — searchable, themed, with the menu
 * portalled to <body> so it never gets clipped by table/overflow containers.
 * Drop-in for native <select>: pass a string `value`, an options array, and an
 * onChange that receives the selected value string ("" when cleared).
 *
 * Every colour comes from the design tokens (--surface/--border/--text/--brand)
 * so the control matches `inputCls` in both light and dark themes.
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
          minHeight: 38,
          borderRadius: 12,
          backgroundColor: state.isDisabled ? "var(--surface-sunken)" : "var(--surface)",
          borderColor: state.isFocused ? "var(--brand)" : "var(--border)",
          boxShadow: state.isFocused ? "0 0 0 3px var(--brand-ring)" : "none",
          ":hover": { borderColor: state.isFocused ? "var(--brand)" : "var(--border-strong)" },
          fontSize: 13,
          transition: "border-color .15s, box-shadow .15s",
        }),
        valueContainer: (base) => ({ ...base, paddingTop: 1, paddingBottom: 1, paddingLeft: 10 }),
        input: (base) => ({ ...base, color: "var(--text)" }),
        placeholder: (base) => ({ ...base, color: "var(--text-mute)" }),
        singleValue: (base) => ({ ...base, color: "var(--text)" }),
        indicatorSeparator: (base) => ({ ...base, backgroundColor: "var(--border)" }),
        dropdownIndicator: (base, state) => ({
          ...base,
          color: state.isFocused ? "var(--brand)" : "var(--text-mute)",
          ":hover": { color: "var(--text-soft)" },
        }),
        clearIndicator: (base) => ({
          ...base,
          color: "var(--text-mute)",
          ":hover": { color: "var(--danger)" },
        }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        menu: (base) => ({
          ...base,
          borderRadius: 12,
          overflow: "hidden",
          fontSize: 13,
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }),
        menuList: (base) => ({ ...base, paddingTop: 4, paddingBottom: 4 }),
        noOptionsMessage: (base) => ({ ...base, color: "var(--text-mute)" }),
        option: (base, state) => ({
          ...base,
          fontSize: 13,
          fontWeight: state.isSelected ? 700 : 500,
          backgroundColor: state.isSelected
            ? "var(--brand-soft)"
            : state.isFocused
              ? "var(--surface-sunken)"
              : "transparent",
          color: state.isSelected ? "var(--brand-strong)" : "var(--text)",
          cursor: "pointer",
          ":active": { backgroundColor: "var(--brand-tint)" },
        }),
      }}
    />
  );
}
