import type { Metadata } from "next";
import { inviteMeta } from "@/lib/server/shareMeta";
import ScreenPage from "./Screen";

type Props = { params: Promise<{ code: string }> };

/** Link preview for this shared page (WhatsApp, Instagram, Facebook, X). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return inviteMeta((await params).code);
}

export default function Page() {
  return <ScreenPage />;
}
