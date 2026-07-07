import apiClient from './axios';

export type EmailType = 'VERIFICATION' | 'PASSWORD_RESET' | 'MATCH_REMINDER' | 'GAGE_RESOLUTION' | 'GROUP_NEW_MATCHES' | 'TEST_CEDRIC';

export type EmailThemeName = 'FOOTBALL' | 'F1';

export const sendTestEmail = async (targetEmail: string, emailType: EmailType, theme: EmailThemeName): Promise<void> => {
  await apiClient.post('/admin/email/test', { targetEmail, emailType, theme });
};
