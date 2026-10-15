import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export function getDeviceId() {
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
  const t = localStorage.getItem("petito_token");
  if (t) config.headers["Authorization"] = `Bearer ${t}`;
  return config;
});

export function mediaUrl(path) {
  if (!path) return null;
  return `${BACKEND_URL}${path}`;
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
export const uploadPetPhoto = (id, file) => {
  const fd = new FormData();
  fd.append("files", file);
  return api.post(`/pets/${id}/photo`, fd).then((r) => r.data);
};
export const revealPet = (id) => api.post(`/pets/${id}/reveal`).then((r) => r.data);
export const getPets = () => api.get("/pets").then((r) => r.data);
export const getPet = (id) => api.get(`/pets/${id}`).then((r) => r.data);
export const updatePet = (id, payload) => api.put(`/pets/${id}`, payload).then((r) => r.data);
export const deletePet = (id) => api.delete(`/pets/${id}`).then((r) => r.data);
export const publicAlbum = (slug) => api.get(`/u/${slug}`).then((r) => r.data);
export const voiceSample = (voiceId) => api.get(`/voice-sample/${voiceId}`).then((r) => r.data);

// ---- Petito Plus ----
export const plusStatus = () => api.get("/plus/status").then((r) => r.data);
export const plusSubscribe = (plan) => api.post("/plus/subscribe", { plan }).then((r) => r.data);
export const plusSync = () => api.post("/plus/sync").then((r) => r.data);
export const plusCancel = () => api.put("/plus/cancel").then((r) => r.data);
export const plusDevActivate = (plan) => api.post("/plus/dev-activate", { plan }).then((r) => r.data);
export const petCreations = (id) => api.get(`/pets/${id}/creations`).then((r) => r.data);

// ---- memories ("Nuestra historia") ----
export const getEmotions = () => api.get("/memories/meta").then((r) => r.data.emotions);
export const listMemories = (petId) => api.get(`/pets/${petId}/memories`).then((r) => r.data);
export const createMemory = (petId, payload) => api.post(`/pets/${petId}/memories`, payload).then((r) => r.data);
export const uploadMemoryPhoto = (id, file) => {
  const fd = new FormData();
  fd.append("files", file);
  return api.post(`/memories/${id}/photo`, fd).then((r) => r.data);
};
export const reflectMemory = (id) => api.post(`/memories/${id}/reflect`).then((r) => r.data);
export const hideMemoryReflection = (id) => api.post(`/memories/${id}/reflect/hide`).then((r) => r.data);
export const toggleMemoryShare = (id) => api.post(`/memories/${id}/share`).then((r) => r.data);
export const getMemory = (id) => api.get(`/memories/${id}`).then((r) => r.data);
export const updateMemory = (id, payload) => api.put(`/memories/${id}`, payload).then((r) => r.data);
export const deleteMemory = (id) => api.delete(`/memories/${id}`).then((r) => r.data);

export const getConfig = () => api.get("/config").then((r) => r.data);
export const createStory = (payload) => api.post("/stories", { pet_id: getActivePetId() || undefined, ...payload }).then((r) => r.data);
export const uploadPhotos = (id, files) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return api.post(`/stories/${id}/photos`, fd).then((r) => r.data);
};
export const generateStory = (id) => api.post(`/stories/${id}/generate`).then((r) => r.data);
export const getStory = (id) => api.get(`/stories/${id}`).then((r) => r.data);
export const getStoryBySlug = (slug) => api.get(`/stories/slug/${slug}`).then((r) => r.data);
export const payDemo = (id) => api.post(`/stories/${id}/pay-demo`).then((r) => r.data);
export const checkout = (id) => api.post(`/stories/${id}/checkout`).then((r) => r.data);
export const saveEmail = (id, email) => api.post(`/stories/${id}/email`, { email }).then((r) => r.data);
export const submitSurvey = (storyId, answer) => api.post("/survey", { story_id: storyId, answer }).then((r) => r.data);

export const createPortrait = (payload) => api.post("/portraits", { pet_id: getActivePetId() || undefined, ...payload }).then((r) => r.data);
export const uploadPortraitPhoto = (id, file) => {
  const fd = new FormData();
  fd.append("files", file);
  return api.post(`/portraits/${id}/photo`, fd).then((r) => r.data);
};
export const generatePortrait = (id) => api.post(`/portraits/${id}/generate`).then((r) => r.data);
export const getPortrait = (id) => api.get(`/portraits/${id}`).then((r) => r.data);
export const getPortraitBySlug = (slug) => api.get(`/portraits/slug/${slug}`).then((r) => r.data);
export const portraitCheckout = (id) => api.post(`/portraits/${id}/checkout`).then((r) => r.data);
export const payPortraitDemo = (id) => api.post(`/portraits/${id}/pay-demo`).then((r) => r.data);

export const adminLogin = (password) => api.post("/admin/login", { password }).then((r) => r.data);
export const adminMetrics = () => api.get("/admin/metrics").then((r) => r.data);
export const adminSurvey = () => api.get("/admin/survey").then((r) => r.data);
export const adminStories = (filter = "all") => api.get(`/admin/stories?filter=${filter}`).then((r) => r.data);

// ---- auth (Emergent Google) ----
export const postSession = (sessionId) =>
  api.post("/auth/session", {}, { headers: { "X-Session-ID": sessionId } }).then((r) => r.data);
export const getMe = () => api.get("/auth/me").then((r) => r.data);
export const logoutApi = () => api.post("/auth/logout").then((r) => r.data);
export const myStories = () => api.get("/me/stories").then((r) => r.data);
export const myPortraits = () => api.get("/me/portraits").then((r) => r.data);
export const myVideos = () => api.get("/me/videos").then((r) => r.data);

// ---- talking video ("Petito Habla") ----
export const createTalkPreview = (file) => {
  const fd = new FormData();
  fd.append("files", file);
  return api.post("/talk/preview", fd).then((r) => r.data);
};
export const createTalk = (payload) => api.post("/talk", { pet_id: getActivePetId() || undefined, ...payload }).then((r) => r.data);
export const uploadTalkPhoto = (id, file) => {
  const fd = new FormData();
  fd.append("files", file);
  return api.post(`/talk/${id}/photo`, fd).then((r) => r.data);
};
export const generateTalk = (id) => api.post(`/talk/${id}/generate`).then((r) => r.data);
export const getTalk = (id) => api.get(`/talk/${id}`).then((r) => r.data);
export const getTalkBySlug = (slug) => api.get(`/talk/slug/${slug}`).then((r) => r.data);
export const talkCheckout = (id) => api.post(`/talk/${id}/checkout`).then((r) => r.data);
