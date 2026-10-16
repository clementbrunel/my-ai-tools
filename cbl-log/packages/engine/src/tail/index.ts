export { PollScheduler, getGlobalPollScheduler, defaultPollInterval, isUncPath, LOCAL_POLL_MS, UNC_POLL_MS } from "./poll-scheduler.js";
export type { PollTask } from "./poll-scheduler.js";
export { Tailer, ANCHOR_BYTES, DEFAULT_COALESCE_MS, DEFAULT_MAX_RETAINED_SEGMENTS } from "./tailer.js";
export type { SegmentOrigin, TailSegment, TailerOptions, TailerPhase } from "./tailer.js";
