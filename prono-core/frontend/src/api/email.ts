import apiClient from './axios';

export type EmailType = 'VERIFICATION';

export const sendTestEmail = async (targetEmail: string, emailType: EmailType): Promise<void> => {
  await apiClient.post('/admin/email/test', { targetEmail, emailType });
};
