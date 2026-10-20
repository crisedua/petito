"use client";
// Shim so the ported screens keep their react-router imports unchanged.
import { useCallback } from "react";
import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";

// Stable across renders, like react-router's: screens list `nav` in effect dependencies, and a new
// function every render made those effects re-run constantly (e.g. reloading a form while typing).
export function useNavigate() {
  const router = useRouter();
  return useCallback((to, opts) => {
    if (typeof to === "number") return to < 0 ? router.back() : router.forward();
    return opts?.replace ? router.replace(to) : router.push(to);
  }, [router]);
}

export function useLocation() {
  const pathname = usePathname();
  const sp = useNextSearchParams();
  const search = sp?.toString() ? `?${sp.toString()}` : "";
  return { pathname, search, hash: "" };
}

export function useParams() {
  return useNextParams();
}

export function Link({ to, href, children, ...rest }) {
  return <NextLink href={to ?? href ?? "/"} {...rest}>{children}</NextLink>;
}

// react-router style: returns [URLSearchParams, setSearchParams].
export function useSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useNextSearchParams();
  const params = new URLSearchParams(sp?.toString() ?? "");
  const set = (next, opts) => {
    const q = new URLSearchParams(typeof next === "function" ? next(params) : next).toString();
    const url = q ? `${pathname}?${q}` : pathname;
    return opts?.replace ? router.replace(url) : router.push(url);
  };
  return [params, set];
}
