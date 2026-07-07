"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import qs from "qs";

import { Input } from "@/components/ui/input";

export const Search = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Initialize from the URL so a shared/bookmarked search link isn't wiped
  // by the first debounce tick.
  const [query, setQuery] = useState(searchParams.get("query") ?? "");

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const current = searchParams.get("query") ?? "";
      if (query === current) return;

      const params = qs.parse(searchParams.toString());

      // A new search starts from page 1.
      delete params.page;

      if (query) {
        params.query = query;
      } else {
        delete params.query;
      }

      const queryString = qs.stringify(params, { skipNulls: true });
      router.push(
        queryString
          ? `${window.location.pathname}?${queryString}`
          : window.location.pathname,
        { scroll: false }
      );
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [router, searchParams, query]);

  return (
    <div className="search">
      <Image
        src="/assets/icons/search.svg"
        alt=""
        width={24}
        height={24}
        className="size-6 shrink-0"
      />

      <Input
        className="search-field"
        placeholder="Search"
        aria-label="Search images"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
};
