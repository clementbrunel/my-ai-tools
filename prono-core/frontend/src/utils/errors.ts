/** Extracts the backend's `{ message }` body from an axios error, falling back otherwise. */
export const extractErrorMessage = (err: unknown, fallback: string): string => {
  const axiosErr = err as { response?: { data?: { message?: string } } };
  return axiosErr.response?.data?.message ?? fallback;
};
