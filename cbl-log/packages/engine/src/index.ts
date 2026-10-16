// Moteur cbl-log : TypeScript pur Node, aucune dependance a Electron.
export const ENGINE_NAME = "@cbl-log/engine";

export function engineInfo(): { name: string } {
  return { name: ENGINE_NAME };
}
