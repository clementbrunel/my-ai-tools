import apiClient from './axios';

export type EmailType = 'VERIFICATION' | 'PASSWORD_RESET' | 'MATCH_REMINDER' | 'GAGE_RESOLUTION' | 'GROUP_NEW_MATCHES' | 'TEST_CEDRIC';

export const sendTestEmail = async (targetEmail: string, emailType: EmailType): Promise<void> => {
  await apiClient.post('/admin/email/test', { targetEmail, emailType });
};
