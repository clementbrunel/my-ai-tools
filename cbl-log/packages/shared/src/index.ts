import { z } from "zod";

/** Identifiant d'un onglet (un fichier ou un motif suivi). */
export type TabId = string;

/** Evenements pousses par le moteur vers le renderer (architecture, section 6). */
export type TabEvent =
  | { type: "rows"; total: number; appended: number }
  | { type: "indexing"; progress: number; provisional: boolean }
  | { type: "rolled"; reason: "rename" | "truncate" | "new-file"; previous?: string; at: number }
  | { type: "state"; state: "following" | "missing" | "error"; message?: string }
  | { type: "query"; id: string; matches: number; done: boolean }
  | { type: "alert"; ruleId: string; line: number };

/** Squelette du schema de configuration (architecture, section 8). */
export const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  theme: z.enum(["system", "dark", "light"]).default("system"),
});

export type Settings = z.infer<typeof settingsSchema>;
