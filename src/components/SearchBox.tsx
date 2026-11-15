"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Icon } from "@/components/Icon";

/** Searches by putting `?q=` in the URL; works as a plain form without JS. */
export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function search(next: string, delay: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = next.trim();
      startTransition(() =>
        router.replace(query ? `${pathname}?q=${encodeURIComponent(query)}` : pathname, { scroll: false }),
      );
    }, delay);
  }

  return (
    <form
      className="search-wrap"
      role="search"
      action={pathname}
      data-pending={pending}
      onSubmit={(event) => {
        event.preventDefault();
        search(value, 0);
      }}
    >
      <Icon name="search" />
      <input
        className="search"
        type="search"
        name="q"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          search(event.target.value, 250);
        }}
        placeholder="Search title or author"
        aria-label="Search books"
      />
    </form>
  );
}
