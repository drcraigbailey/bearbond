import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabaseClient';

const PUSH_CHANNEL_ID = 'bearbond-actions';

const ensureNotificationChannel = async () => {
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
};

const showForegroundPushNotification = async (notification) => {
  try {
    await LocalNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: 'BearBond actions',
      description: 'Notifications when your partner sends a BearBond action.',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
    });

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483647),
          title: notification?.title || 'BearBond',
          body: notification?.body || 'Your partner sent you something! ❤️',
          channelId: PUSH_CHANNEL_ID,
          autoCancel: true,
        },
      ],
    });
  } catch (error) {
    console.warn('Could not show foreground push notification:', error);
  }
};

const savePushToken = async ({ userId, token }) => {
  if (!userId || !token) return false;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      push_token: token,
      push_platform: Capacitor.getPlatform(),
      push_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('Could not save push token:', error.message);
    return false;
  }

  if (!data?.id) {
    console.warn('Could not save push token: profile row was not found yet.');
    return false;
  }

  console.log('BearBond push token saved for user:', userId);
  return true;
};

export const registerPushNotifications = async (userId) => {
  if (!userId || !Capacitor.isNativePlatform()) return false;

  try {
    await ensureNotificationChannel();

    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener('registration', async (token) => {
      await savePushToken({ userId, token: token.value });
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push registration error:', error.error || error);
    });

    await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      await showForegroundPushNotification(notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notificationAction) => {
      console.log('BearBond push notification tapped:', notificationAction);
    });

    let permissionStatus = await PushNotifications.checkPermissions();

    if (permissionStatus.receive === 'prompt') {
      permissionStatus = await PushNotifications.requestPermissions();
    }

    if (permissionStatus.receive !== 'granted') {
      console.warn('Push notifications permission was not granted.');
      return false;
    }

    await PushNotifications.register();
    return true;
  } catch (error) {
    console.warn('Could not register push notifications:', error);
    return false;
  }
};
