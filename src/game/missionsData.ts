import type { StoryMission } from './types';
import { STORY_MISSIONS_EARLY } from './missionsEarly';
import { STORY_MISSIONS_LATE } from './missionsLate';

export const STORY_MISSIONS: StoryMission[] = [
  ...STORY_MISSIONS_EARLY,
  ...STORY_MISSIONS_LATE,
];
