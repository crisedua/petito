import { randomBytes, randomUUID } from "node:crypto";

export const newId = () => randomUUID();
export const newSlug = () => randomBytes(5).toString("hex"); // 10 hex chars, like uuid4().hex[:10]
export const newUserId = () => `user_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
export const isoNow = () => new Date().toISOString();
export const hex16 = () => randomBytes(8).toString("hex");
