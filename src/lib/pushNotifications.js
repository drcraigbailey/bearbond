import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabaseClient';

const PUSH_CHANNEL_ID = 'bearbond-actions';

const savePushToken = async ({ userId, token }) => {
  if (!userId || !token) return;

  const { error } = await supabase
    .from('profiles')
    .update({
      push_token: token,
      push_platform: Capacitor.getPlatform(),
      push_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.warn('Could not save push token:', error.message);
  }
};

export const registerPushNotifications = async (userId) => {
  if (!userId || !Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'BearBond actions',
      description: 'Notifications when your partner sends a BearBond action.',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
    });

    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener('registration', async (token) => {
      await savePushToken({ userId, token: token.value });
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push registration error:', error.error);
    });

    let permissionStatus = await PushNotifications.checkPermissions();

    if (permissionStatus.receive === 'prompt') {
      permissionStatus = await PushNotifications.requestPermissions();
    }

    if (permissionStatus.receive !== 'granted') {
      console.warn('Push notifications permission was not granted.');
      return;
    }

    await PushNotifications.register();
  } catch (error) {
    console.warn('Could not register push notifications:', error);
  }
};
