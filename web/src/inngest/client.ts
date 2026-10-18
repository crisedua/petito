import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "petito" });

/** Event names (data payloads are small: ids only). */
export const EV = {
  storyGenerate: "story/generate",
  portraitGenerate: "portrait/generate",
  talkGenerate: "talk/generate",
  talkClean: "talk/clean",
  falResult: "fal/result",
} as const;
