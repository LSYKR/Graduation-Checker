"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { FocusEvent, KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import {
  getKmouProgramOffering,
  getKmouProgramSearchAliases,
  searchKmouProgramOptions,
  type KmouProgramOffering,
} from "@/lib/kmou-program-catalog";

interface ProgramSearchSelectProps {
  admissionYear: number | null;
  value: string;
  onChange: (programId: string) => void;
}

function supportingText(offering: KmouProgramOffering): string {
  const aliases = getKmouProgramSearchAliases(offering)
    .filter((alias) => alias !== offering.displayName && alias !== offering.currentUnit)
    .slice(0, 2);
  const current = offering.currentUnit !== offering.displayName ? `현재 ${offering.currentUnit}` : "";
  return [current, aliases.length ? `관련 ${aliases.join(" · ")}` : ""].filter(Boolean).join(" · ");
}

export default function ProgramSearchSelect({ admissionYear, value, onChange }: ProgramSearchSelectProps) {
  const generatedId = useId().replace(/:/g, "");
  const inputId = `program-search-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(
    () => admissionYear === null ? undefined : getKmouProgramOffering(admissionYear, value),
    [admissionYear, value],
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(
    () => admissionYear === null ? [] : searchKmouProgramOptions(admissionYear, query),
    [admissionYear, query],
  );

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  function openAll() {
    if (admissionYear === null) return;
    setQuery("");
    setOpen(true);
    const selectedIndex = searchKmouProgramOptions(admissionYear, "")
      .findIndex((offering) => offering.programId === value);
    setActiveIndex(Math.max(0, selectedIndex));
  }

  function select(offering: KmouProgramOffering) {
    onChange(offering.programId);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openAll();
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter" && open && results[safeActiveIndex]) {
      event.preventDefault();
      select(results[safeActiveIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      setOpen(false);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="program-search-select" onBlurCapture={handleBlur}>
      <div className={`program-search-input ${open ? "open" : ""}`}>
        <Search size={15} aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-label="학부(과)·전공 검색"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && results[safeActiveIndex] ? `${inputId}-option-${results[safeActiveIndex].programId}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={admissionYear === null ? "학번을 먼저 선택해주세요" : "전공명 검색 (예: 컴퓨터, 자동제어)"}
          disabled={admissionYear === null}
          value={open ? query : selected?.displayName ?? ""}
          onFocus={() => {
            if (!open) openAll();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          aria-label={open ? "전공 목록 닫기" : "전공 목록 열기"}
          aria-expanded={open}
          disabled={admissionYear === null}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) {
              setQuery("");
              setOpen(false);
            } else {
              openAll();
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {open && (
        <ul id={listboxId} className="program-search-results" role="listbox" aria-label={`${admissionYear ?? "미선택"}학번 전공 검색 결과`}>
          {results.length ? results.map((offering, index) => (
            <li key={offering.programId} role="none">
              <button
                id={`${inputId}-option-${offering.programId}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={offering.programId === value}
                className={`${index === safeActiveIndex ? "active" : ""} ${offering.programId === value ? "selected" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(offering)}
              >
                <span>
                  <strong>{offering.displayName}</strong>
                  <small>{supportingText(offering)}</small>
                </span>
                {offering.programId === value && <Check size={15} aria-hidden="true" />}
              </button>
            </li>
          )) : (
            <li className="program-search-empty">검색 결과가 없습니다. 입학년도나 과거 전공 명칭을 확인해주세요.</li>
          )}
        </ul>
      )}
    </div>
  );
}
