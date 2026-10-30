import React, { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

export interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  /** When true, typing automatically populates/selects the best matching option by label and shows inline completion. */
  autoPopulate?: boolean;
  dropdownClassName?: string;
  "data-testid"?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  searchPlaceholder = "Type to filter...",
  className,
  dropdownClassName,
  disabled = false,
  autoPopulate = false,
  "data-testid": dataTestId,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownSearchRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () =>
      options.find((o) => o.value === value) ||
      (value
        ? options.find((o) => o.label.toLowerCase() === String(value).toLowerCase())
        : undefined),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const startsWith: SearchableSelectOption[] = [];
    const includes: SearchableSelectOption[] = [];
    for (const opt of options) {
      const labelLower = opt.label.toLowerCase();
      const subLower = (opt.subLabel || "").toLowerCase();
      const valLower = autoPopulate ? "" : opt.value.toLowerCase();
      if (labelLower.startsWith(q) || subLower.startsWith(q)) {
        startsWith.push(opt);
      } else if (labelLower.includes(q) || subLower.includes(q) || (valLower && valLower.includes(q))) {
        includes.push(opt);
      }
    }
    return [...startsWith, ...includes];
  }, [options, query, autoPopulate]);

  // Inline ghost completion when the top match starts with the user's typed query
  const inlineCompletion = useMemo(() => {
    if (!open || !query) return "";
    const top = filteredOptions[highlightedIndex] || filteredOptions[0];
    if (!top) return "";
    if (top.label.toLowerCase().startsWith(query.toLowerCase())) {
      return query + top.label.slice(query.length);
    }
    return "";
  }, [open, query, filteredOptions, highlightedIndex]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open && !disabled) {
      const timer = setTimeout(() => {
        dropdownSearchRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [open, disabled]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (autoPopulate && query.trim()) {
          const match = filteredOptions[highlightedIndex] || filteredOptions[0];
          if (match) {
            onValueChange(match.value);
          }
        }
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [autoPopulate, query, filteredOptions, highlightedIndex, onValueChange]);

  const handleSelect = (opt: SearchableSelectOption) => {
    onValueChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  const handleQueryChange = (nextVal: string) => {
    setQuery(nextVal);
    if (!open) setOpen(true);
    if (autoPopulate) {
      const q = nextVal.trim().toLowerCase();
      if (!q) {
        onValueChange("");
      } else {
        const starts = options.find((o) => o.label.toLowerCase().startsWith(q));
        const contains = starts || options.find((o) => o.label.toLowerCase().includes(q));
        if (contains) {
          onValueChange(contains.value);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0;
        if (autoPopulate && filteredOptions[next]) {
          onValueChange(filteredOptions[next].value);
        }
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next =
          filteredOptions.length > 0
            ? (prev - 1 + filteredOptions.length) % filteredOptions.length
            : 0;
        if (autoPopulate && filteredOptions[next]) {
          onValueChange(filteredOptions[next].value);
        }
        return next;
      });
    } else if (e.key === "Enter" || (e.key === "Tab" && query.trim() && filteredOptions[highlightedIndex])) {
      if (e.key === "Enter") e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "ArrowRight" && inlineCompletion && filteredOptions[highlightedIndex]) {
      const activeInput = dropdownSearchRef.current || inputRef.current;
      if (activeInput && activeInput.selectionStart === query.length) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      dropdownSearchRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} data-testid={dataTestId}>
      <div
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
        }}
      >
        <div className="relative flex-1 min-w-0 flex items-center">
          {autoPopulate && inlineCompletion && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center text-sm text-gray-400 truncate select-none"
            >
              {inlineCompletion}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={open ? query : selectedOption?.label || ""}
            placeholder={open ? selectedOption?.label || placeholder : placeholder}
            onFocus={() => {
              if (!disabled) setOpen(true);
            }}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "relative z-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground truncate",
              open && selectedOption && !query && "placeholder:text-foreground",
            )}
          />
        </div>
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {((open && query) || (autoPopulate && selectedOption)) && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                setQuery("");
                if (autoPopulate) {
                  onValueChange("");
                }
                setOpen(true);
                dropdownSearchRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 opacity-50 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </div>
      </div>

      {open && !disabled && (
        <div
          role="listbox"
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-50 !h-auto rounded-md border border-gray-200 bg-white text-popover-foreground shadow-lg overflow-hidden",
            dropdownClassName,
          )}
        >
          {/* First component in the droplist: Search input box to filter as user types */}
          <div className="p-1.5 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={dropdownSearchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-gray-200 bg-gray-50/70 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-colors"
              />
              {query && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                    if (autoPopulate) {
                      onValueChange("");
                    }
                    dropdownSearchRef.current?.focus();
                  }}
                  className="absolute right-2 text-gray-400 hover:text-gray-600 p-0.5"
                  aria-label="Clear filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto overscroll-contain p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedOption?.value === opt.value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm py-1.5 pl-2.5 pr-8 text-sm outline-none transition-colors",
                      isHighlighted ? "bg-blue-50 text-blue-900" : "text-gray-900 hover:bg-gray-50",
                      isSelected && "font-medium",
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span className="text-xs text-gray-500 truncate">{opt.subLabel}</span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center text-blue-600">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-3 px-2 text-center text-xs text-gray-500">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
