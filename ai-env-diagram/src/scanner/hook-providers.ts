/**
 * Catalogue of known hook providers detected in Claude Code settings.
 * Key = executable name (no path, no extension) as returned by extractProvider().
 * Add new entries as new tools/plugins are discovered.
 *
 * Sources:
 *  - GitKraken: https://help.gitkraken.com/cli/cli-home/
 *  - MemPalace:  https://github.com/MemPalace/mempalace
 *  - Caveman:    https://github.com/JuliusBrussee/caveman
 */

export interface HookProviderInfo {
  /** Display name shown in the diagram node */
  name: string;
  /** One-line description of what this provider does with the hooks */
  description: string;
  /**
   * Per-event descriptions. Key = Claude Code event name.
   * Leave empty if the provider registers all events for the same purpose.
   */
  events?: Record<string, string>;
}

export const HOOK_PROVIDER_CATALOGUE: Record<string, HookProviderInfo> = {
  // ---------------------------------------------------------------------------
  // GitKraken CLI  (gk.exe / gk)
  // Installed automatically by GitKraken Desktop ≥ 12.0 in user settings.json.
  // Forwards all lifecycle events to the local gk process so GitKraken Desktop
  // can display live agent status, session timeline, and telemetry.
  // Payload is minimal: only the agent name + event name (no code, no prompts).
  // Opt-out: Preferences → External Tools → Uninstall Claude Code hooks.
  // ---------------------------------------------------------------------------
  gk: {
    name: "GitKraken CLI",
    description: "Forwards lifecycle events to GitKraken Desktop for live agent status display",
    events: {
      SessionStart: "Marks session open in GitKraken timeline",
      SessionEnd: "Marks session close, flushes telemetry",
      UserPromptSubmit: "Tracks user turn count",
      PreToolUse: "Logs tool invocation start",
      PostToolUse: "Logs tool result + duration",
      PostToolUseFailure: "Logs tool error",
      PermissionRequest: "Shows permission prompt in GitKraken UI",
      PermissionDenied: "Logs denied permission",
      Stop: "Marks agent stop event",
      StopFailure: "Marks abnormal stop",
      SubagentStart: "Tracks subagent spawn",
      SubagentStop: "Tracks subagent end",
      TaskCompleted: "Marks task done in timeline",
      TeammateIdle: "Detects idle state",
      PreCompact: "Logs pre-compaction checkpoint",
      PostCompact: "Logs post-compaction resume",
      ConfigChange: "Detects settings.json modifications",
      CwdChanged: "Tracks working directory changes",
      Notification: "Forwards notifications to GitKraken",
      Elicitation: "Logs clarification requests",
      ElicitationResult: "Logs clarification responses",
      InstructionsLoaded: "Logs CLAUDE.md load",
    },
  },

  // ---------------------------------------------------------------------------
  // MemPalace  (bash → mempal-*.sh or Python scripts)
  // Long-term memory palace for Claude Code.
  // Two hooks form a two-pass save cycle:
  //   PreCompact: emergency save before context is compacted (block → AI saves)
  //   Stop:       checkpoint save every ~15 messages (block → AI saves → lets through)
  // ---------------------------------------------------------------------------
  bash: {
    name: "MemPalace",
    description: "Auto-saves session memories to palace before compaction or session end",
    events: {
      PreCompact: "Emergency save — blocks compaction, forces AI to write key content to palace before context is lost",
      Stop: "Checkpoint save — blocks stop, AI saves topics/decisions/quotes, then releases",
    },
  },

  // ---------------------------------------------------------------------------
  // Caveman  (node → caveman-activate.js / caveman-mode-tracker.js)
  // Token-reduction skill that makes Claude respond in compressed caveman style.
  // SessionStart injects hidden system context activating caveman mode.
  // UserPromptSubmit detects mode-change commands (/caveman ultra, etc.)
  //   and updates the flag file read by the skill at inference time.
  // ---------------------------------------------------------------------------
  node: {
    name: "Caveman",
    description: "Activates and tracks caveman token-reduction mode across turns",
    events: {
      SessionStart: "Writes ~/.claude/.caveman-active flag; injects hidden system context to activate mode",
      UserPromptSubmit: "Reads flag + detects /caveman commands to switch intensity level in real time",
    },
  },

  // ---------------------------------------------------------------------------
  // RTK — Rust Token Killer  (rtk)
  // CLI proxy that compresses command output before sending to Claude.
  // Uses PreToolUse/PostToolUse to wrap commands transparently.
  // No known hook registration in settings.json (operates as CLI wrapper, not hook).
  // Entry kept for future detection if RTK adds hook integration.
  // ---------------------------------------------------------------------------
  rtk: {
    name: "RTK (Rust Token Killer)",
    description: "CLI proxy compressing command output — no hooks registered, operates as transparent wrapper",
  },
};

/**
 * Look up provider info by executable name.
 * Returns undefined if the provider is not in the catalogue.
 */
export function getProviderInfo(providerKey: string): HookProviderInfo | undefined {
  return HOOK_PROVIDER_CATALOGUE[providerKey.toLowerCase()];
}
