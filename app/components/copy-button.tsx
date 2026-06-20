"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Small copy-to-clipboard button with a brief "copied!" confirmation. Falls
// back to a hidden textarea for older browsers / non-secure contexts.
export function CopyButton({
  text,
  label,
  copiedLabel,
  className = "pc-btn pc-btn--ghost pc-btn--sm",
}: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more we can do */
      }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={className}
      aria-label={copied ? copiedLabel : label}
      style={{ whiteSpace: "nowrap", flex: "none" }}
    >
      {copied ? (
        <>
          <Check size={14} aria-hidden /> {copiedLabel}
        </>
      ) : (
        <>
          <Copy size={14} aria-hidden /> {label}
        </>
      )}
    </button>
  );
}
