import apiClient from './axios';

export type NewsletterTheme = 'FOOTBALL' | 'F1';
export type NewsletterStatus = 'DRAFT' | 'SENT';

export interface Newsletter {
  id: number;
  title: string;
  subtitle?: string;
  bodyMd: string;
  theme: NewsletterTheme;
  ctaLabel?: string;
  ctaUrl?: string;
  status: NewsletterStatus;
  sentCount: number;
  createdBy?: string;
  createdAt?: string;
  sentAt?: string;
}

export interface NewsletterInput {
  title: string;
  subtitle?: string;
  bodyMd: string;
  theme: NewsletterTheme;
  ctaLabel?: string;
  ctaUrl?: string;
}

export const listNewsletters = async (): Promise<Newsletter[]> => {
  const res = await apiClient.get<Newsletter[]>('/admin/newsletter');
  return res.data;
};

export const createNewsletter = async (input: NewsletterInput): Promise<Newsletter> => {
  const res = await apiClient.post<Newsletter>('/admin/newsletter', input);
  return res.data;
};

export const updateNewsletter = async (id: number, input: NewsletterInput): Promise<Newsletter> => {
  const res = await apiClient.put<Newsletter>(`/admin/newsletter/${id}`, input);
  return res.data;
};

export const deleteNewsletter = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/newsletter/${id}`);
};

export const previewNewsletter = async (id: number): Promise<string> => {
  const res = await apiClient.get<string>(`/admin/newsletter/${id}/preview`, { responseType: 'text' });
  return res.data;
};

export const sendNewsletterTest = async (id: number, targetEmail: string): Promise<void> => {
  await apiClient.post(`/admin/newsletter/${id}/test`, { targetEmail });
};

export const broadcastNewsletter = async (id: number): Promise<number> => {
  const res = await apiClient.post<{ recipientCount: number }>(`/admin/newsletter/${id}/send`);
  return res.data.recipientCount;
};
