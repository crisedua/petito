import axios from "axios";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Same-origin API (Next.js route handlers). Media paths are already absolute (/api/media/...).
export const API = "/api";

export function getDeviceId() {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem("cp_device_id");
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("cp_device_id", id);
  }
  return id;
}

export const api = axios.create({ baseURL: API, withCredentials: true });
api.interceptors.request.use((config) => {
  config.headers["X-Device-Id"] = getDeviceId();
  return config;
});

export function mediaUrl(path) {
  if (!path) return null;
  return path;
}

// Uploads go browser -> Supabase Storage via signed URLs (no 4.5 MB request limit), then the API
// processes them. `endpoint` is the legacy upload path; it also accepts multipart for small files.
async function uploadFiles(endpoint, files) {
  const list = files.filter(Boolean);
  const { data: signed } = await api.post(`${endpoint}/sign`, { count: list.length });
  const bucket = supabaseBrowser().storage.from("media");
  await Promise.all(signed.uploads.map(async (u, i) => {
    const { error } = await bucket.uploadToSignedUrl(u.path, u.token, list[i], { contentType: list[i].type || "application/octet-stream" });
    if (error) throw error;
  }));
  return api.post(endpoint, { raw: signed.uploads.map((u) => u.name) }).then((r) => r.data);
}

// ---- active pet (El universo de mi mascota) ----
export function getActivePetId() {
  return localStorage.getItem("petito_active_pet") || "";
}
export function setActivePetId(id) {
  if (id) localStorage.setItem("petito_active_pet", id);
}
export function clearActivePet() {
  localStorage.removeItem("petito_active_pet");
}

export const getPetsMeta = () => api.get("/pets/meta").then((r) => r.data);
export const createPet = (payload) => api.post("/pets", payload).then((r) => r.data);
export const uploadPetPhoto = (id, file) => uploadFiles(`/pets/${id}/photo`, [file]);
export const revealPet = (id) => api.post(`/pets/${id}/reveal`).then((r) => r.data);
export const getPets = () => api.get("/pets").then((r) => r.data);
export const getPet = (id) => api.get(`/pets/${id}`).then((r) => r.data);
export const updatePet = (id, payload) => api.put(`/pets/${id}`, payload).then((r) => r.data);
export const deletePet = (id) => api.delete(`/pets/${id}`).then((r) => r.data);
export const publicAlbum = (slug) => api.get(`/u/${slug}`).then((r) => r.data);
export const voiceSample = (voiceId) => api.get(`/voice-sample/${voiceId}`).then((r) => r.data);

// ---- Petipop Plus ----
export const plusStatus = () => api.get("/plus/status").then((r) => r.data);
export const plusSubscribe = (plan, email, from) => api.post("/plus/subscribe", { plan, email, from }).then((r) => r.data);
export const plusSync = () => api.post("/plus/sync").then((r) => r.data);
export const plusCancel = () => api.put("/plus/cancel").then((r) => r.data);
export const plusDevActivate = (plan) => api.post("/plus/dev-activate", { plan }).then((r) => r.data);
export const plusAdminActivate = (plan) => api.post("/plus/admin-activate", { plan }).then((r) => r.data);
export const plusAdminDeactivate = () => api.post("/plus/admin-deactivate").then((r) => r.data);
export const petCreations = (id) => api.get(`/pets/${id}/creations`).then((r) => r.data);

// ---- memories ("Nuestra historia") ----
export const getEmotions = () => api.get("/memories/meta").then((r) => r.data.emotions);
export const listMemories = (petId) => api.get(`/pets/${petId}/memories`).then((r) => r.data);
export const createMemory = (petId, payload) => api.post(`/pets/${petId}/memories`, payload).then((r) => r.data);
export const uploadMemoryPhoto = (id, file) => uploadFiles(`/memories/${id}/photo`, [file]);
export const reflectMemory = (id) => api.post(`/memories/${id}/reflect`).then((r) => r.data);
export const hideMemoryReflection = (id) => api.post(`/memories/${id}/reflect/hide`).then((r) => r.data);
export const toggleMemoryShare = (id) => api.post(`/memories/${id}/share`).then((r) => r.data);
export const getMemory = (id) => api.get(`/memories/${id}`).then((r) => r.data);
export const updateMemory = (id, payload) => api.put(`/memories/${id}`, payload).then((r) => r.data);
export const deleteMemory = (id) => api.delete(`/memories/${id}`).then((r) => r.data);

export const getConfig = () => api.get("/config").then((r) => r.data);
export const createStory = (payload) => api.post("/stories", { pet_id: getActivePetId() || undefined, ...payload }).then((r) => r.data);
export const uploadPhotos = (id, files) => uploadFiles(`/stories/${id}/photos`, files);
export const generateStory = (id) => api.post(`/stories/${id}/generate`).then((r) => r.data);
export const getStory = (id) => api.get(`/stories/${id}`).then((r) => r.data);
export const getStoryBySlug = (slug) => api.get(`/stories/slug/${slug}`).then((r) => r.data);
export const checkout = (id, auto = false) => api.post(`/stories/${id}/checkout`, { auto }).then((r) => r.data);
export const saveEmail = (id, email) => api.post(`/stories/${id}/email`, { email }).then((r) => r.data);

export const createPortrait = (payload) => api.post("/portraits", { pet_id: getActivePetId() || undefined, ...payload }).then((r) => r.data);
export const uploadPortraitPhoto = (id, file) => uploadFiles(`/portraits/${id}/photo`, [file]);
export const generatePortrait = (id) => api.post(`/portraits/${id}/generate`).then((r) => r.data);
export const getPortrait = (id) => api.get(`/portraits/${id}`).then((r) => r.data);
export const getPortraitBySlug = (slug) => api.get(`/portraits/slug/${slug}`).then((r) => r.data);
export const portraitCheckout = (id, auto = false) => api.post(`/portraits/${id}/checkout`, { auto }).then((r) => r.data);
/** "Pruébalo gratis": one photo → a portrait in the house style, no account needed. Returns { id, slug }. */
export const tryPortrait = async (file, petName) => {
  const start = await api.post("/portraits/try", { pet_name: petName || undefined, pet_id: getActivePetId() || undefined }).then((r) => r.data);
  await uploadFiles(`/portraits/${start.id}/photo`, [file]);
  await api.post(`/portraits/${start.id}/generate`);
  return start;
};
export const claimPortrait = (id) => api.post(`/portraits/${id}/claim`, { pet_id: getActivePetId() || undefined }).then((r) => r.data);
const CLAIM_KEY = "petito_claim_portrait";
export const rememberClaim = (id) => { try { localStorage.setItem(CLAIM_KEY, id); } catch { /* ignore */ } };
/** Claims the free try made before signing in, once. Returns the portrait or null. */
export async function claimPending() {
  let id = null;
  try { id = localStorage.getItem(CLAIM_KEY); } catch { return null; }
  if (!id) return null;
  try {
    const p = await claimPortrait(id);
    localStorage.removeItem(CLAIM_KEY);
    return p;
  } catch (e) {
    if (e?.response?.status === 404) localStorage.removeItem(CLAIM_KEY);
    return null;
  }
}

export const adminLogin = (password) => api.post("/admin/login", { password }).then((r) => r.data);
export const adminMetrics = () => api.get("/admin/metrics").then((r) => r.data);
export const adminSurvey = () => api.get("/admin/survey").then((r) => r.data);
export const adminStories = (filter = "all") => api.get(`/admin/stories?filter=${filter}`).then((r) => r.data);
export const adminUsers = (q = "", filter = "") => api.get("/admin/users", { params: { q, filter } }).then((r) => r.data);
export const adminCreateUser = (payload) => api.post("/admin/users", payload).then((r) => r.data);
export const adminUpdateUser = (id, patch) => api.patch(`/admin/users/${id}`, patch).then((r) => r.data);
export const adminUserDetail = (id) => api.get(`/admin/users/${id}`).then((r) => r.data);
export const adminSetPlus = (id, active, opts = {}) => api.post(`/admin/users/${id}/plus`, { active, ...opts }).then((r) => r.data);
export const adminDeletePet = (id) => api.delete(`/admin/pets/${id}`).then((r) => r.data);
export const adminDeleteUser = (id) => api.delete(`/admin/users/${id}`).then((r) => r.data);
export const adminDeleteCreation = (kind, id) => api.delete(`/admin/creations/${kind}/${id}`).then((r) => r.data);
export const adminCreations = () => api.get("/admin/creations").then((r) => r.data);
export const adminFunnel = (days = 30) => api.get("/admin/funnel", { params: { days } }).then((r) => r.data);
export const adminEvents = (params = {}) => api.get("/admin/events", { params }).then((r) => r.data);

// ---- auth (Supabase Auth, Google) ----
export const getMe = () => api.get("/auth/me").then((r) => r.data);
export const logoutApi = () => api.post("/auth/logout").then((r) => r.data);
export const myStories = () => api.get("/me/stories").then((r) => r.data);
export const myPortraits = () => api.get("/me/portraits").then((r) => r.data);
export const myVideos = () => api.get("/me/videos").then((r) => r.data);

// ---- talking video ("Petipop Habla") ----
export const createTalkPreview = async (file, meta = {}) => {
  const { data: start } = await api.post("/talk/preview/start", meta);
  await uploadFiles(`/talk/preview/${start.id}`, [file]);
  return api.post(`/talk/preview/${start.id}/generate`).then((r) => r.data);
};
export const createTalk = (payload) => api.post("/talk", { pet_id: getActivePetId() || undefined, ...payload }).then((r) => r.data);
export const uploadTalkPhoto = (id, file) => uploadFiles(`/talk/${id}/photo`, [file]);
export const generateTalk = (id) => api.post(`/talk/${id}/generate`).then((r) => r.data);
export const getTalk = (id) => api.get(`/talk/${id}`).then((r) => r.data);
export const getTalkBySlug = (slug) => api.get(`/talk/slug/${slug}`).then((r) => r.data);
export const talkCheckout = (id, auto = false) => api.post(`/talk/${id}/checkout`, { auto }).then((r) => r.data);

// ---- Amigos de Petipop ----
export const getFriends = () => api.get("/amigos").then((r) => r.data);
export const friendsSummary = () => api.get("/amigos/summary").then((r) => r.data);
export const resetFriendCode = () => api.post("/amigos/code").then((r) => r.data);
export const getInvite = (code) => api.get(`/amigos/invite/${code}`).then((r) => r.data);
export const acceptInvite = (code) => api.post(`/amigos/invite/${code}`).then((r) => r.data);
export const requestConnection = (petSlug) => api.post("/amigos/request", { pet_slug: petSlug }).then((r) => r.data);
export const acceptConnection = (id) => api.post(`/amigos/${id}/accept`).then((r) => r.data);
export const endConnection = (id) => api.delete(`/amigos/${id}`).then((r) => r.data);
export const getFeed = (before) => api.get("/feed", { params: before ? { before } : {} }).then((r) => r.data);
export const shareOptions = () => api.get("/shares/options").then((r) => r.data);
export const createShare = (kind, itemId, note) => api.post("/shares", { kind, item_id: itemId, note }).then((r) => r.data);
export const deleteShare = (id) => api.delete(`/shares/${id}`).then((r) => r.data);
export const toggleHeart = (id) => api.post(`/shares/${id}/heart`).then((r) => r.data);
export const getComments = (id) => api.get(`/shares/${id}/comments`).then((r) => r.data);
export const addComment = (id, body) => api.post(`/shares/${id}/comments`, { body }).then((r) => r.data);
export const deleteComment = (id, cid) => api.delete(`/shares/${id}/comments/${cid}`).then((r) => r.data);

/** Name of the pet chosen in its universe (or the account's first pet), or "" if none. */
export async function activePetName() {
  try {
    const id = getActivePetId();
    const p = id ? await getPet(id) : (await getPets())[0];
    return p?.name || "";
  } catch {
    return "";
  }
}

export const portraitSamples = () => api.get("/portraits/samples").then((r) => r.data);
export const adminStyleSamples = () => api.get("/admin/style-samples").then((r) => r.data);
export const adminGenerateSample = (style, frame, petId, engine) => api.post("/admin/style-samples", { style, frame, pet_id: petId || undefined, engine: engine || undefined }, { timeout: 70000 }).then((r) => r.data);
export const adminSetImageEngine = (key) => api.put("/admin/style-samples", { default_engine: key }).then((r) => r.data);
export const adminChooseSample = (style, name) => api.put("/admin/style-samples", { style, name }).then((r) => r.data);
export const getShowcase = () => api.get("/showcase").then((r) => r.data);
export const adminShowcase = () => api.get("/admin/showcase").then((r) => r.data);
export const adminSetShowcase = (items) => api.put("/admin/showcase", { items }).then((r) => r.data);
export const adminDances = () => api.get("/admin/dances").then((r) => r.data);
export const adminGenerateDance = (key) => api.post("/admin/dances", { key }).then((r) => r.data);
