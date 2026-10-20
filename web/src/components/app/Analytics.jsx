"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { featureForPath, oncePerDay, oncePerSession, shareFeatureForPath, track, visitSource } from "@/lib/track";

/** Records a visit once a day per browser, and which feature pages / shared links get opened. */
export function Analytics() {
  const path = usePathname() || "/";

  useEffect(() => {
    if (oncePerDay("petito_visit")) {
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
      track("visit", { props: { ...visitSource(), path: window.location.pathname, mobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent), app: Boolean(standalone) } });
    }
    const onInstalled = () => track("install");
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  useEffect(() => {
    if (path.startsWith("/admin")) return;
    const f = featureForPath(path);
    if (f && oncePerSession(`petito_view_${f}`)) track("view_feature", { feature: f });
    const s = shareFeatureForPath(path);
    if (s && oncePerSession(`petito_share_${path}`)) track("share_open", { feature: s, props: { ...visitSource() } });
  }, [path]);

  return null;
}
