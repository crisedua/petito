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

export const getConfig = () => api.get("/config").then((r) => r.data);
export const createStory = (payload) => api.post("/stories", payload).then((r) => r.data);
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

export const createPortrait = (payload) => api.post("/portraits", payload).then((r) => r.data);
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
