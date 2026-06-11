import apiClient from './axios';

export type EmailType = 'VERIFICATION' | 'PASSWORD_RESET';

export const sendTestEmail = async (targetEmail: string, emailType: EmailType): Promise<void> => {
  await apiClient.post('/admin/email/test', { targetEmail, emailType });
};
