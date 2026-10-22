/**
 * Who may touch a creation job (portrait or video) before it is shared: its signed-in owner, or for
 * the no-account free try, the device that started it. Everyone else gets a plain 404.
 */
import { getCurrentUser, type AppUser } from "./auth";
import { deviceId, fail } from "./http";

type Job = { user_id?: string | null; device_id?: string | null; status?: string | null };

export async function assertJobOwner(job: Job, req: Request): Promise<AppUser | null> {
  if (job.user_id) {
    const me = await getCurrentUser(req);
    if (!me || me.user_id !== job.user_id) throw fail(404, "No encontrado");
    return me;
  }
  if (job.device_id && job.device_id !== deviceId(req)) throw fail(404, "No encontrado");
  return null;
}

/** Only a draft (or a run that failed) can be started: a repeated click must not pay for the same job twice. */
export function assertStartable(job: Job) {
  if (!["draft", "failed"].includes(String(job.status ?? "draft"))) throw fail(409, "Esta creación ya está en marcha o lista");
}
