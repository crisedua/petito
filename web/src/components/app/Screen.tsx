"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import RequireAuth from "@/components/RequireAuth";

const Spinner = () => (
  <div className="mobile-frame grid place-items-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

/**
 * The ported screens read localStorage / window.Audio during render, so they are mounted client-only.
 * `gate` wraps the screen in RequireAuth with the legacy subtitle.
 */
export function screen(load: () => Promise<{ default: React.ComponentType<any> }>, gate?: string) {
  const C = dynamic(load, { ssr: false, loading: Spinner });
  return function ScreenPage() {
    return (
      <Suspense fallback={<Spinner />}>
        {gate ? <RequireAuth subtitle={gate}><C /></RequireAuth> : <C />}
      </Suspense>
    );
  };
}
