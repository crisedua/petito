import { db } from "./db";
import { fail } from "./http";
import { isoNow } from "./ids";
import type { MemoryRow, PetRow } from "./serializers";
import { inngest, EV } from "@/inngest/client";

export async function getPet(petId: string, userId: string): Promise<PetRow> {
  const { data } = await db().from("pets").select("*").eq("id", petId).eq("user_id", userId).maybeSingle();
  if (!data) throw fail(404, "Mascota no encontrada");
  return data as PetRow;
}

export async function getMemory(memoryId: string, userId: string): Promise<MemoryRow> {
  const { data } = await db().from("memories").select("*").eq("id", memoryId).eq("user_id", userId).maybeSingle();
  if (!data) throw fail(404, "Recuerdo no encontrado");
  return data as MemoryRow;
}

/** Returns petId only if that pet belongs to the user (legacy `_validate_pet_id`). */
export async function validatePetId(petId: unknown, userId: string): Promise<string | null> {
  if (typeof petId !== "string" || !petId) return null;
  const { data } = await db().from("pets").select("id").eq("id", petId).eq("user_id", userId).maybeSingle();
  return data ? petId : null;
}

/** Marks a talking video paid and queues the clean HD render (legacy `_talk_mark_paid_and_finalize`). */
export async function talkMarkPaidAndFinalize(videoId: string) {
  await db().from("videos").update({ status: "paid", paid_at: isoNow() }).eq("id", videoId).neq("status", "paid");
  await inngest.send({ name: EV.talkClean, data: { video_id: videoId } });
}
