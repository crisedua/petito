import { EMOTIONS, EMOTION_LABELS, PERSONALITY_LABELS } from "@/lib/catalogs";
import { iso } from "./db";
import { mediaPath } from "./storage";

export type PetRow = {
  id: string; share_slug: string; user_id: string; name: string; species: string; personality: string[];
  personality_text: string | null; favorite_memory: string | null; photo_file: string | null; intro_text: string | null;
  birthday: string | null; adoption_date: string | null; public_enabled: boolean; created_at: string;
};
export type MemoryRow = {
  id: string; pet_id: string; user_id: string; title: string; happened_on: string | null; date_unknown: boolean;
  feeling_text: string | null; emotions: string[]; photo_file: string | null; ai_reflection: string | null;
  shared: boolean; created_at: string; updated_at: string;
};

export const petPublic = (p: PetRow) => ({
  id: p.id,
  slug: p.share_slug,
  name: p.name,
  species: p.species,
  personality: p.personality ?? [],
  personality_text: p.personality_text,
  personality_labels: (p.personality ?? []).map((k) => PERSONALITY_LABELS[k] ?? k),
  favorite_memory: p.favorite_memory,
  photo_url: p.photo_file ? mediaPath(p.id, p.photo_file) : null,
  intro_text: p.intro_text,
  birthday: p.birthday,
  adoption_date: p.adoption_date,
  public_enabled: p.public_enabled,
  share_slug: p.share_slug,
  created_at: iso(p.created_at),
});

export const emotionLabels = (keys: string[]) =>
  (keys ?? []).map((k) => ({ key: k, label: EMOTION_LABELS[k] ?? k, emoji: EMOTIONS.find((e) => e.key === k)?.emoji ?? "" }));

export const memoryPublic = (m: MemoryRow) => ({
  id: m.id,
  pet_id: m.pet_id,
  title: m.title,
  happened_on: m.happened_on,
  date_unknown: m.date_unknown,
  feeling_text: m.feeling_text,
  emotions: m.emotions ?? [],
  emotion_labels: emotionLabels(m.emotions),
  photo_url: m.photo_file ? mediaPath(m.id, m.photo_file) : null,
  ai_reflection: m.ai_reflection,
  shared: m.shared,
  created_at: iso(m.created_at),
  updated_at: iso(m.updated_at),
});
