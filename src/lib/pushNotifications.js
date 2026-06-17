import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabaseClient';

const PUSH_CHANNEL_ID = 'bearbond-actions';
const PENDING_PUSH_EVENT_KEY = 'bearbond.pendingPushEvent';

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

const extractPushData = (payload) => {
  return (
    payload?.notification?.extra ||
    payload?.notification?.data ||
    payload?.data ||
    payload?.extra ||
    payload ||
    null
  );
};

const dispatchBearBondPushEvent = (payload) => {
  if (typeof window === 'undefined') return;

  const data = extractPushData(payload);
  if (!data?.pairId || !data?.actionName) return;

  const eventDetail = {
    ...data,
    receivedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(PENDING_PUSH_EVENT_KEY, JSON.stringify(eventDetail));
  } catch (_error) {
    // Ignore storage failures; the live event below can still work.
  }

  window.dispatchEvent(new CustomEvent('bearbond-push-event', { detail: eventDetail }));
};

const showForegroundPushNotification = async (notification) => {
  try {
    const notificationData = extractPushData(notification) || {};

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
          extra: notificationData,
        },
      ],
    });
  } catch (error) {
    console.warn('Could not show foreground push notification:', error);
  }
};

const savePushToken = async ({ userId, token }) => {
  if (!userId || !token) return false;

  const { data, error } = await supabase.functions.invoke('save-push-token', {
    body: {
      token,
      platform: Capacitor.getPlatform(),
    },
  });

  if (error) {
    console.warn('Could not save push registration:', error.message || error);
    return false;
  }

  if (!data?.saved) {
    console.warn('Push registration was not saved:', data);
    return false;
  }

  console.log('BearBond push registration saved for user:', userId);
  return true;
};

export const registerPushNotifications = async (userId) => {
  if (!userId || !Capacitor.isNativePlatform()) return false;

  try {
    await ensureNotificationChannel();

    await PushNotifications.removeAllListeners();
    await LocalNotifications.removeAllListeners();

    await LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      console.log('BearBond local notification tapped:', notificationAction);
      dispatchBearBondPushEvent(notificationAction);
    });

    await PushNotifications.addListener('registration', async (token) => {
      const saved = await savePushToken({ userId, token: token.value });
      console.log(saved ? 'BearBond push registration complete.' : 'BearBond push registration not saved.');
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push registration error:', error.error || error);
    });

    await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      dispatchBearBondPushEvent(notification);
      await showForegroundPushNotification(notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notificationAction) => {
      console.log('BearBond push notification tapped:', notificationAction);
      dispatchBearBondPushEvent(notificationAction);
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
