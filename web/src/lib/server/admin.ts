import { db, iso } from "./db";
import { isPlus } from "./plus";
import { createServiceClient } from "./supabase";

export async function countsForUser(uid: string) {
  const c = async (table: string, f: (q: any) => any = (q) => q) =>
    (await f(db().from(table).select("id", { count: "exact", head: true }).eq("user_id", uid))).count ?? 0;
  const pets = await c("pets");
  const creations = (await c("stories", (q) => q.neq("status", "draft"))) + (await c("portraits")) + (await c("videos"));
  return { pets, creations };
}

export const adminUserRow = async (d: any, isAdminEmail: (e: string) => boolean) => {
  const { pets, creations } = await countsForUser(d.user_id);
  return {
    user_id: d.user_id, email: d.email, name: d.name, picture: d.picture, is_admin: isAdminEmail(d.email),
    is_plus: await isPlus(d.user_id), pet_count: pets, creation_count: creations, created_at: iso(d.created_at),
  };
};

async function deleteStories(filter: { col: string; val: string }) {
  // slides cascade from stories via FK
  await db().from("stories").delete().eq(filter.col, filter.val);
}

export async function deletePetCascade(petId: string) {
  await db().from("memories").delete().eq("pet_id", petId);
  await deleteStories({ col: "pet_id", val: petId });
  await db().from("portraits").delete().eq("pet_id", petId);
  await db().from("videos").delete().eq("pet_id", petId);
  await db().from("pets").delete().eq("id", petId);
}

export async function deleteUserCascade(userId: string) {
  const { data: u } = await db().from("app_users").select("auth_user_id").eq("user_id", userId).maybeSingle();
  await deleteStories({ col: "user_id", val: userId });
  await db().from("portraits").delete().eq("user_id", userId);
  await db().from("videos").delete().eq("user_id", userId);
  // memories, pets and subscriptions cascade from app_users
  await db().from("app_users").delete().eq("user_id", userId);
  if (u?.auth_user_id) await createServiceClient().auth.admin.deleteUser(u.auth_user_id).catch(() => {});
}
