import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import clsx from "clsx";
import { format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval,
         isSameDay, isSameMonth, addMonths, subMonths, getDay } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DatePickerProps {
  value?: string;           // "yyyy-MM-dd" or ""
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  minDate?: string;         // "yyyy-MM-dd"
  maxDate?: string;         // "yyyy-MM-dd"
}

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

// ── DatePicker ────────────────────────────────────────────────────────────────

export default function DatePicker({
  value, onChange, placeholder = "Select date", className = "",
  error = false, disabled = false, minDate, maxDate,
}: DatePickerProps) {
  const selectedDate = value && isValid(parseISO(value)) ? parseISO(value) : null;
  const [open,    setOpen]    = useState(false);
  const [viewing, setViewing] = useState(selectedDate ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keep viewing month in sync when value changes externally
  useEffect(() => {
    if (selectedDate) setViewing(selectedDate);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthStart = startOfMonth(viewing);
  const monthEnd   = endOfMonth(viewing);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart); // 0 = Sun

  const minD = minDate && isValid(parseISO(minDate)) ? parseISO(minDate) : null;
  const maxD = maxDate && isValid(parseISO(maxDate)) ? parseISO(maxDate) : null;

  function isDisabledDay(d: Date) {
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  }

  function select(d: Date) {
    if (isDisabledDay(d)) return;
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  }

  const displayValue = selectedDate ? format(selectedDate, "MMM dd, yyyy") : "";

  return (
    <div ref={ref} className={clsx("relative", className)}>
      {/* Trigger input */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={clsx(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
          "bg-aq-dark border focus:outline-none",
          error
            ? "border-red-500/60 focus:border-red-500"
            : open
            ? "border-aq-blue/60"
            : "border-aq-border hover:border-aq-border/80 focus:border-aq-blue/60",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Calendar size={14} className="flex-shrink-0 text-aq-dim" />
        <span className={clsx("flex-1 truncate", displayValue ? "text-aq-text" : "text-aq-dim/50")}>
          {displayValue || placeholder}
        </span>
        {selectedDate && !disabled && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="text-aq-dim hover:text-aq-text text-xs leading-none px-1"
          >
            ✕
          </span>
        )}
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 bg-aq-card border border-aq-border rounded-xl shadow-xl shadow-black/40
                        select-none min-w-[256px]"
             style={{ top: "calc(100% + 4px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-aq-border">
            <button
              type="button"
              onClick={() => setViewing((v) => subMonths(v, 1))}
              className="p-1 rounded hover:bg-aq-border/40 text-aq-dim hover:text-aq-text transition-colors"
            >
              <ChevronLeft size={15} />
            </button>

            <div className="flex items-center gap-2">
              <select
                value={viewing.getMonth()}
                onChange={(e) => setViewing((v) => new Date(v.getFullYear(), +e.target.value, 1))}
                className="text-sm font-semibold text-aq-text bg-transparent border-none outline-none cursor-pointer"
              >
                {MONTHS.map((m, i) => <option key={m} value={i} className="bg-aq-card">{m}</option>)}
              </select>
              <select
                value={viewing.getFullYear()}
                onChange={(e) => setViewing((v) => new Date(+e.target.value, v.getMonth(), 1))}
                className="text-sm font-semibold text-aq-text bg-transparent border-none outline-none cursor-pointer w-16"
              >
                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 80 + i).map((y) => (
                  <option key={y} value={y} className="bg-aq-card">{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setViewing((v) => addMonths(v, 1))}
              className="p-1 rounded hover:bg-aq-border/40 text-aq-dim hover:text-aq-text transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 px-2 pt-2 pb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-aq-dim py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
            {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
            {days.map((d) => {
              const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
              const isToday    = isSameDay(d, new Date());
              const inMonth    = isSameMonth(d, viewing);
              const off        = isDisabledDay(d);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={off}
                  onClick={() => select(d)}
                  className={clsx(
                    "h-8 w-full rounded-lg text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-aq-blue text-white"
                      : isToday
                      ? "bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30"
                      : inMonth
                      ? "text-aq-text hover:bg-aq-border/40"
                      : "text-aq-dim/40",
                    off && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer — Today */}
          <div className="border-t border-aq-border px-3 py-2">
            <button
              type="button"
              onClick={() => { select(new Date()); setViewing(new Date()); }}
              className="text-xs text-aq-blue-2 hover:underline"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
