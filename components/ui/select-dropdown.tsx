"use client";

import * as React from "react";
import { Check } from "@phosphor-icons/react/Check";
import { CaretDown } from "@phosphor-icons/react/CaretDown";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectDropdownProps = {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Shown when value is an empty string. */
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Dropdown select built on the shadcn DropdownMenu primitives, styled to match
 * TextInput/TextArea. Options with an empty value act as "no selection" and
 * render via placeholder.
 */
export function SelectDropdown({
  id,
  value,
  options,
  onValueChange,
  disabled,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: SelectDropdownProps) {
  const selected = options.find((opt) => opt.value === value);
  const label = selected ? selected.label : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-field border border-line bg-surface px-3.5 text-base transition-colors hover:border-ink/25 focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60",
            label ? "text-ink" : "text-muted",
            className,
          )}
        >
          <span className="truncate font-medium">
            {label || placeholder || "Chọn..."}
          </span>
          <CaretDown size={16} className="shrink-0 text-muted" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto"
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <DropdownMenuItem
              key={opt.value || "__empty__"}
              onClick={() => onValueChange(opt.value)}
              className={cn(
                "flex items-center justify-between py-2.5",
                isSelected && "bg-accent-soft/40 font-medium text-accent-text",
              )}
            >
              <span className="truncate">{opt.label}</span>
              {isSelected ? (
                <Check size={14} weight="bold" className="text-accent" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}