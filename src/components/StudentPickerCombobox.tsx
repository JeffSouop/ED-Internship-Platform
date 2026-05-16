import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

import type { Student } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type StudentPickerComboboxProps = {
  students: Student[];
  value: string;
  onValueChange: (studentId: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
};

function studentLabel(s: Student) {
  return `${s.lastName} ${s.firstName}`;
}

function matchesStudent(s: Student, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    s.id.toLowerCase().includes(q) ||
    s.firstName.toLowerCase().includes(q) ||
    s.lastName.toLowerCase().includes(q) ||
    s.email.toLowerCase().includes(q) ||
    `${s.lastName} ${s.firstName}`.toLowerCase().includes(q)
  );
}

export function StudentPickerCombobox({
  students,
  value,
  onValueChange,
  disabled,
  id,
  placeholder = "Saisir un nom, un e-mail ou un n° étudiant…",
  className,
}: StudentPickerComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const updateDropdownPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const maxHeight = Math.min(280, Math.max(120, window.innerHeight - rect.bottom - gap - 16));
    setDropdownRect({
      top: rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, []);

  const selected = students.find((s) => s.id === value);

  useEffect(() => {
    if (selected && !open) {
      setQuery(studentLabel(selected));
    } else if (!value && !open) {
      setQuery("");
    }
  }, [selected, value, open]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return students.slice(0, 50);
    return students.filter((s) => matchesStudent(s, q)).slice(0, 50);
  }, [students, query]);

  const exactIdMatch = useMemo(() => {
    const q = query.trim();
    if (!q) return undefined;
    return students.find((s) => s.id.toLowerCase() === q.toLowerCase());
  }, [students, query]);

  const showSearchIcon = !query.trim();

  function pick(student: Student) {
    onValueChange(student.id);
    setQuery(studentLabel(student));
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      setDropdownRect(null);
      return;
    }
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest("[data-student-picker-list]")
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-opacity duration-150",
            showSearchIcon ? "opacity-100" : "opacity-0",
          )}
        />
        <Input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          className={cn(
            "h-12 border-primary/25 bg-background text-base shadow-sm transition-[padding] duration-150",
            showSearchIcon ? "pl-10" : "pl-3",
          )}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onValueChange("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (exactIdMatch) pick(exactIdMatch);
              else if (filtered[0]) pick(filtered[0]);
            }
          }}
        />
      </div>

      {open &&
        !disabled &&
        dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            data-student-picker-list
            className="z-[200] overflow-y-auto overscroll-contain rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
            style={{
              position: "fixed",
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight,
            }}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Aucun étudiant trouvé.
              </li>
            ) : (
              filtered.map((s) => (
                <li key={s.id} role="option" aria-selected={value === s.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary",
                      value === s.id && "bg-secondary font-medium",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                  >
                    {s.lastName} {s.firstName}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}

      <p className="mt-2 text-xs text-muted-foreground">
        Tapez pour filtrer, ou collez un n° étudiant exact puis Entrée.
      </p>
    </div>
  );
}
