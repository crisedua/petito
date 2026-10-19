import type { Metadata } from "next";
import { storyMeta } from "@/lib/server/shareMeta";
import ScreenPage from "./Screen";

type Props = { params: Promise<{ slug: string }> };

/** Link preview for this shared page (WhatsApp, Instagram, Facebook, X). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return storyMeta((await params).slug);
}

export default function Page() {
  return <ScreenPage />;
}
