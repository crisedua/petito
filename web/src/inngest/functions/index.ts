import { generateTalk, talkClean } from "./talk";
import { generatePortrait } from "./portrait";
import { generateStory, generateBonusScenes, narrateSlide } from "./story";

export const functions = [generateTalk, talkClean, generatePortrait, generateStory, generateBonusScenes, narrateSlide];
