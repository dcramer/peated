"use client";

import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import BrandIcon from "@peated/web/assets/brand.svg";
import DistillerIcon from "@peated/web/assets/distiller.svg";
import Button from "@peated/web/components/button";
import {
  COLLECTION_BOTTLE_STATUS_META,
  COLLECTION_BOTTLE_STATUS_VALUES,
} from "@peated/web/components/libraryBottleStatus";
import SelectDialog from "@peated/web/components/selectField/selectDialog";
import type { Option } from "@peated/web/components/selectField/types";
import TextInput from "@peated/web/components/textInput";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ElementType, type FormEvent } from "react";

type FilterOption = {
  id: number;
  name: string;
};

const FILTER_PARAMS = ["query", "brand", "distiller", "status", "cursor"];
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Any" },
  ...COLLECTION_BOTTLE_STATUS_VALUES.map((status) => ({
    value: status,
    label: COLLECTION_BOTTLE_STATUS_META[status].label,
  })),
  { value: "unset", label: "Not set" },
];

function entityOption(entity?: FilterOption | null) {
  return entity ? { id: entity.id, name: entity.name } : undefined;
}

function useLibraryFilters() {
  const searchParams = useSearchParams();

  const query = searchParams.get("query") ?? "";
  const brand = searchParams.get("brand");
  const distiller = searchParams.get("distiller");
  const status = searchParams.get("status") ?? "";

  return {
    query,
    brandId: brand ? Number(brand) : null,
    distillerId: distiller ? Number(distiller) : null,
    status,
    hasActiveFilters: Boolean(query || brand || distiller || status),
  };
}

export function LibraryFilters({
  loading = false,
  onNavigate,
}: {
  loading?: boolean;
  onNavigate: (href: string) => void;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { query, brandId, distillerId, status, hasActiveFilters } =
    useLibraryFilters();

  const brandQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: Number(brandId) },
    }),
    enabled: !!brandId,
  });
  const distillerQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: Number(distillerId) },
    }),
    enabled: !!distillerId,
  });

  const brand = entityOption(brandQuery.data);
  const distiller = entityOption(distillerQuery.data);

  function pushParams(nextParams: URLSearchParams) {
    const nextQuery = nextParams.toString();
    onNavigate(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function setFilter(name: string, value?: string | number | null) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("cursor");

    if (value) {
      nextParams.set(name, String(value));
    } else {
      nextParams.delete(name);
    }

    pushParams(nextParams);
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    FILTER_PARAMS.forEach((name) => nextParams.delete(name));
    pushParams(nextParams);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = String(data.get("query") ?? "").trim();
    setFilter("query", value);
  }

  return (
    <div
      className="mb-3 px-3 sm:mb-4 sm:px-0"
      aria-busy={loading ? "true" : undefined}
    >
      <div className="overflow-hidden rounded border border-slate-800 bg-slate-950/70">
        {loading && (
          <div
            className="bg-highlight h-0.5 animate-pulse"
            aria-hidden="true"
          />
        )}
        <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
          <form
            onSubmit={handleSearch}
            className="min-w-0 flex-1"
            role="search"
          >
            <div className="flex h-10 items-center gap-2 rounded bg-slate-900 px-3 ring-1 ring-inset ring-slate-800 focus-within:ring-slate-600">
              <MagnifyingGlassIcon className="text-muted h-5 w-5 shrink-0" />
              <label className="sr-only" htmlFor="library-query">
                Search library
              </label>
              <TextInput
                key={query}
                id="library-query"
                type="search"
                name="query"
                defaultValue={query}
                placeholder="Search library"
                className="h-10 min-w-0 flex-1 bg-transparent px-0 py-0"
              />
              <Button size="small" type="submit" loading={loading}>
                Search
              </Button>
            </div>
          </form>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
            <LibraryEntityFilter
              label="Brand"
              icon={BrandIcon}
              placeholder="Any brand"
              value={brand}
              loading={brandQuery.isFetching}
              searchContextType="brand"
              onChange={(value) => setFilter("brand", value?.id)}
              onClear={() => setFilter("brand")}
            />
            <LibraryEntityFilter
              label="Distillery"
              icon={DistillerIcon}
              placeholder="Any distillery"
              value={distiller}
              loading={distillerQuery.isFetching}
              searchContextType="distiller"
              onChange={(value) => setFilter("distiller", value?.id)}
              onClear={() => setFilter("distiller")}
            />
            <LibraryStatusFilter
              value={status}
              onChange={(value) => setFilter("status", value)}
            />
          </div>

          {hasActiveFilters && (
            <Button
              icon={<XMarkIcon className="h-4 w-4" />}
              onClick={clearFilters}
              title="Clear filters"
              aria-label="Clear filters"
              loading={loading}
              className="sm:shrink-0"
            />
          )}
        </div>

        {(query || status) && (
          <div className="flex flex-wrap gap-2 border-t border-slate-800 px-2 py-2">
            {query && (
              <ActiveFilterChip
                label={`Search: ${query}`}
                onClear={() => setFilter("query")}
              />
            )}
            {status && (
              <ActiveFilterChip
                label={`Status: ${getStatusFilterLabel(status)}`}
                onClear={() => setFilter("status")}
              />
            )}
          </div>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {loading ? "Loading library results" : ""}
      </span>
    </div>
  );
}

function getStatusFilterLabel(status: string) {
  return (
    STATUS_FILTER_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function LibraryStatusFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value?: string) => void;
}) {
  return (
    <div className="relative min-w-0 sm:w-36">
      <label className="sr-only" htmlFor="library-status">
        Status
      </label>
      <select
        id="library-status"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value || undefined)}
        className={classNames(
          "h-10 w-full rounded border bg-slate-900 px-3 text-sm shadow-sm",
          value
            ? "border-highlight/60 text-white"
            : "border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white",
        )}
      >
        {STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option.value || "any"} value={option.value}>
            {option.value ? option.label : `Status: ${option.label}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function LibraryEntityFilter({
  label,
  icon: Icon,
  placeholder,
  value,
  loading,
  searchContextType,
  onChange,
  onClear,
}: {
  label: string;
  icon: ElementType;
  placeholder: string;
  value?: FilterOption;
  loading?: boolean;
  searchContextType: "brand" | "distiller";
  onChange: (value?: Option) => void;
  onClear: () => void;
}) {
  const orpc = useORPC();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative min-w-0 sm:w-44">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={classNames(
            "flex h-10 w-full min-w-0 items-center gap-2 rounded border px-3 text-left text-sm shadow-sm",
            value
              ? "border-highlight/60 bg-slate-900 text-white"
              : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:text-white",
            loading ? "animate-pulse" : "",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Icon className="text-muted h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase leading-3 text-slate-500">
              {label}
            </span>
            <span className="block truncate leading-5">
              {value?.name ?? placeholder}
            </span>
          </span>
          <ChevronDownIcon className="text-muted h-4 w-4 shrink-0" />
        </button>
        {value && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={`Clear ${label.toLowerCase()} filter`}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <SelectDialog<Option>
        open={open}
        setOpen={setOpen}
        onSelect={(option) => {
          onChange(option);
          setOpen(false);
        }}
        selectedValues={value ? [value] : []}
        searchPlaceholder={`Search ${label.toLowerCase()}`}
        onQuery={async (query) => {
          const { results } = await orpc.entities.list.call({
            query,
            searchContext: { type: searchContextType },
          });
          return results;
        }}
        onRenderOption={(item) => (
          <div className="flex flex-col items-start">
            <div>{item.name}</div>
            <div className="text-muted font-normal">
              {item.shortName || null}
            </div>
          </div>
        )}
      />
    </>
  );
}

function ActiveFilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex h-7 max-w-full items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white"
    >
      <span className="truncate">{label}</span>
      <XMarkIcon className="h-4 w-4 shrink-0" />
    </button>
  );
}
