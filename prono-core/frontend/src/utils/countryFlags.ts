export const getFlagUrl = (iso2: string | null | undefined): string | null => {
  return iso2 ? `https://flagcdn.com/${iso2}.svg` : null;
};
