// feedback.json in the user data folder: when reports were opened, for the anti-flood of feedback.ts.
// Never fatal: an unusable file is ignored (it is rewritten by the next report).
import { join } from "node:path";
import { loadJson, type Loaded } from "./config-store";
import { emptyFeedbackHistory, parseFeedbackHistory, type FeedbackHistory } from "./feedback";
import { writeJsonAtomic } from "./json-file";

export const loadFeedbackHistory = (dir: string): Promise<Loaded<FeedbackHistory>> =>
  loadJson(join(dir, "feedback.json"), "feedback.json", parseFeedbackHistory, emptyFeedbackHistory);

export const saveFeedbackHistory = (dir: string, history: FeedbackHistory): Promise<string> =>
  writeJsonAtomic(join(dir, "feedback.json"), history);
