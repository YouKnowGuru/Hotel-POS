import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

export const getTodayLocalDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDaysToIso = (isoDate, days) => {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseIsoDate = (isoDate) => new Date(`${isoDate}T12:00:00`);

export const formatDateButtonLabel = (isoDate, allDates = false) => {
  if (allDates) return 'All Dates';
  const today = getTodayLocalDate();
  const formatted = parseIsoDate(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  if (isoDate === today) return `Today, ${formatted}`;
  return formatted;
};

/**
 * Calendar button that opens a date picker popover (restores pre-redesign behaviour).
 */
const DatePickerButton = ({
  value,
  onChange,
  allDates = false,
  onAllDates,
  showAllDatesOption = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const maxDate = getTodayLocalDate();

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pickDate = (iso) => {
    if (onAllDates) onAllDates(false);
    onChange(iso);
    setOpen(false);
  };

  const openNativePicker = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      if (inputRef.current?.showPicker) {
        try {
          inputRef.current.showPicker();
        } catch {
          inputRef.current?.click();
        }
      } else {
        inputRef.current?.click();
      }
    });
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openNativePicker())}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
          open || !allDates
            ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            : 'bg-orange-50 border-orange-200 text-orange-600'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
        <span>{formatDateButtonLabel(value, allDates)}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 z-50 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4"
          role="dialog"
          aria-label="Select date"
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Select date
          </p>
          <input
            ref={inputRef}
            type="date"
            value={allDates ? maxDate : value}
            max={maxDate}
            onChange={(e) => {
              if (e.target.value) pickDate(e.target.value);
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => pickDate(getTodayLocalDate())}
              className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-xs font-semibold hover:bg-orange-100"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => pickDate(addDaysToIso(getTodayLocalDate(), -1))}
              className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold hover:bg-gray-100"
            >
              Yesterday
            </button>
            {showAllDatesOption && onAllDates && (
              <button
                type="button"
                onClick={() => {
                  onAllDates(true);
                  setOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-xs font-semibold hover:bg-gray-100"
              >
                All dates
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePickerButton;
