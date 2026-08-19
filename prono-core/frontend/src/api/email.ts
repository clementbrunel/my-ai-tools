import apiClient from './axios';

export type EmailType = 'VERIFICATION' | 'PASSWORD_RESET' | 'MATCH_REMINDER' | 'RACE_REMINDER' | 'QUALIFYING_REMINDER' | 'GAGE_RESOLUTION' | 'DAILY_SCORES_RECAP' | 'GROUP_NEW_MATCHES' | 'GROUP_NEW_RACES' | 'GROUP_MEMBERSHIP_REQUEST' | 'ADMIN_UNRESOLVED_ALERT' | 'TEST_CEDRIC';

export const sendTestEmail = async (targetEmail: string, emailType: EmailType): Promise<void> => {
  await apiClient.post('/admin/email/test', { targetEmail, emailType });
};
