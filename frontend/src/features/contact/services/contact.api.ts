import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/services/api-client';

export type ContactMessage = {
  subject: string;
  message: string;
  /** Guests only: where to answer. Signed-in users are answered at their account's address. */
  email?: string;
};

/** Forwards the message to the team inbox (contact@hintvaders.app). Rejects with 429 when sent too often. */
export async function sendContactMessage(msg: ContactMessage): Promise<void> {
  await api.post('/contact/', {
    ...msg,
    app_version: Constants.expoConfig?.version,
    platform: Platform.OS,
  });
}
