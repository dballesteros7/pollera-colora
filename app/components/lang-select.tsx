"use client";

export function LangSelect({
  current,
  options,
  ariaLabel,
}: {
  current: string;
  options: { code: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <select
      className="pc-lang-select"
      aria-label={ariaLabel}
      defaultValue={current}
      onChange={(e) => {
        window.location.href = `/api/lang?l=${e.target.value}`;
      }}
    >
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
