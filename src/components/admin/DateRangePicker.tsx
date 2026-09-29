"use client";

import { useMemo, useState } from "react";

type DateRangeValue = {
  dateFrom?: string;
  dateTo?: string;
};

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function subtractDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export function DateRangePicker({
  value,
  onChange,
}: DateRangePickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const [preset, setPreset] = useState("");

  const setRange = (from: Date, to: Date) => {
    onChange({
      dateFrom: formatDate(from),
      dateTo: formatDate(to),
    });
  };

  const handlePreset = (selectedPreset: string) => {
    setPreset(selectedPreset);

    const current = startOfDay(new Date());

    switch (selectedPreset) {
      case "today":
        setRange(current, current);
        break;

      case "yesterday": {
        const yesterday = subtractDays(current, 1);
        setRange(yesterday, yesterday);
        break;
      }

      case "last7":
        setRange(subtractDays(current, 6), current);
        break;

      case "last30":
        setRange(subtractDays(current, 29), current);
        break;

      case "thisMonth": {
        const firstDay = new Date(
          current.getFullYear(),
          current.getMonth(),
          1,
        );

        setRange(firstDay, current);
        break;
      }

      case "lastMonth": {
        const firstDay = new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1,
        );

        const lastDay = new Date(
          current.getFullYear(),
          current.getMonth(),
          0,
        );

        setRange(firstDay, lastDay);
        break;
      }

      default:
        break;
    }
  };

  const handleCustomDateChange = (
    field: "dateFrom" | "dateTo",
    date: string,
  ) => {
    setPreset("");

    onChange({
      ...value,
      [field]: date || undefined,
    });
  };

  const handleClear = () => {
    setPreset("");
    onChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(event) => {
          if (event.target.value) {
            handlePreset(event.target.value);
          }
        }}
        className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
      >
        <option value="" disabled>
          Date range
        </option>

        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last7">Last 7 days</option>
        <option value="last30">Last 30 days</option>
        <option value="thisMonth">This month</option>
        <option value="lastMonth">Last month</option>
      </select>

      <input
        type="date"
        value={value.dateFrom ?? ""}
        max={value.dateTo ?? formatDate(today)}
        onChange={(event) =>
          handleCustomDateChange("dateFrom", event.target.value)
        }
        className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
      />

      <span className="text-sm text-neutral-500">→</span>

      <input
        type="date"
        value={value.dateTo ?? ""}
        min={value.dateFrom ?? undefined}
        max={formatDate(today)}
        onChange={(event) =>
          handleCustomDateChange("dateTo", event.target.value)
        }
        className="h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
      />

      {(value.dateFrom || value.dateTo) && (
        <button
          type="button"
          onClick={handleClear}
          className="h-10 px-3 text-sm text-neutral-500 transition hover:text-black"
        >
          Clear
        </button>
      )}
    </div>
  );
}