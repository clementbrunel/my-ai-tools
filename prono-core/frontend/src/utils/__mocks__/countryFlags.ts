export const getFlagUrl = (iso2: string | null | undefined) =>
  iso2 ? `https://flags.example.com/${iso2}.png` : null;
