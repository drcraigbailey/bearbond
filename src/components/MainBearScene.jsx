import { useEffect, useRef, useState } from 'react';
import { supabase, getRemainLoggedInPreference, setRemainLoggedInPreference } from '../lib/supabaseClient';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapacitorApp } from '@capacitor/app';
import BearSprite from './BearSprite';
import AdminPanel from './AdminPanel';
import { SCENES as DEFAULT_SCENES } from '../data/scenes';
import { ACTIONS } from '../data/actions';
import { AVATARS as DEFAULT_AVATARS, getAvatarName } from '../data/avatarSets';
import logoImg from '../assets/bear/yogi/main.png';

const BEARBOND_NOTIFICATION_CHANNEL = 'bearbond-actions';
const PENDING_PUSH_EVENT_KEY = 'bearbond.pendingPushEvent';
const BACKGROUND_MUSIC_SRC = '/music/Summit_Jig.mp3';
const MUSIC_ENABLED_STORAGE_KEY = 'bearbond.musicEnabled';
const SOUNDS_ENABLED_STORAGE_KEY = 'bearbond.soundsEnabled';
const ACTION_SOUND_SOURCES = {
  chicken: '/sounds/fuckoff.wav',
  kiss: '/sounds/kiss.wav',
  love: '/sounds/kiss.wav',
  night: '/sounds/night.wav',
  sleep: '/sounds/night.wav',
};

const getStoredBooleanPreference = (key, fallback = false) => {
  if (typeof window === 'undefined') return fallback;

  const storedValue = window.localStorage.getItem(key);
  if (storedValue === null) return fallback;
  return storedValue === 'true';
};

const saveBooleanPreference = (key, value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value ? 'true' : 'false');
};

const getSceneStorageKey = (pairId, userId) => `bearbond.scene.${pairId}.${userId}`;

const getStoredScene = (pairId, userId) => {
  if (typeof window === 'undefined' || !pairId || !userId) return null;
  return window.localStorage.getItem(getSceneStorageKey(pairId, userId));
};

const saveStoredScene = (pairId, userId, sceneId) => {
  if (typeof window === 'undefined' || !pairId || !userId || !sceneId) return;
  window.localStorage.setItem(getSceneStorageKey(pairId, userId), sceneId);
};

const setupLocalNotifications = async () => {
  try {
    const currentPermission = await LocalNotifications.checkPermissions();

    if (currentPermission.display !== 'granted') {
      const requestedPermission = await LocalNotifications.requestPermissions();
      if (requestedPermission.display !== 'granted') return false;
    }

    await LocalNotifications.createChannel({
      id: BEARBOND_NOTIFICATION_CHANNEL,
      name: 'BearBond actions',
      description: 'Notifications when your partner sends a BearBond action.',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
    });

    return true;
  } catch (error) {
    console.log('Local notifications are only available on native Android/iOS.', error);
    return false;
  }
};

const sendLocalActionNotification = async ({ partnerName, actionName, notificationBody }) => {
  const canNotify = await setupLocalNotifications();
  if (!canNotify) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        title: 'BearBond',
        body: notificationBody || `${partnerName} just sent you a ${actionName}! ❤️`,
        id: Math.floor(Date.now() % 2147483647),
        channelId: BEARBOND_NOTIFICATION_CHANNEL,
        autoCancel: true,
      },
    ],
  });
};

const trimPushError = (message) => {
  if (!message) return 'Function error';
  return String(message).slice(0, 180);
};

const describeFunctionPayload = (payload) => {
  if (!payload) return '';
  if (payload.details?.error?.message) return `${payload.error || 'Firebase error'}: ${payload.details.error.message}`;
  if (payload.details?.message) return `${payload.error || 'Firebase error'}: ${payload.details.message}`;
  if (payload.error) return payload.error;
  if (payload.reason) return payload.reason;
  if (payload.message) return payload.message;
  return '';
};

const getEdgeFunctionErrorMessage = async (error) => {
  const response = error?.context || error?.response;

  try {
    if (response?.clone && typeof response.clone === 'function') {
      const text = await response.clone().text();

      if (text) {
        try {
          const payload = JSON.parse(text);
          const payloadMessage = describeFunctionPayload(payload);
          if (payloadMessage) return trimPushError(payloadMessage);
        } catch (_jsonError) {
          return trimPushError(text);
        }
      }
    }
  } catch (_readError) {
    // Fall through to generic message.
  }

  return trimPushError(error?.message || 'Function error');
};

export default function MainBearScene({
  user,
  pair,
  profile,
  partnerProfile,
  scenes = DEFAULT_SCENES,
  avatars = DEFAULT_AVATARS,
  avatarSprites,
  onPairReset,
  onCharacterChange,
  onAvatarChange,
  onDisplayNameChange,
  onLogout,
}) {
  const [activeScene, setActiveScene] = useState(() => getStoredScene(pair.id, user.id) || 'home');
  const [scenePickerValue, setScenePickerValue] = useState('');
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [toastMessage, setToastMessage] = useState('');
  const [isPartnerConnected, setIsPartnerConnected] = useState(!!pair.user_two_id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [remainLoggedIn, setRemainLoggedIn] = useState(getRemainLoggedInPreference());
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState(profile.display_name || '');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(() => getStoredBooleanPreference(MUSIC_ENABLED_STORAGE_KEY, false));
  const [soundsEnabled, setSoundsEnabled] = useState(() => getStoredBooleanPreference(SOUNDS_ENABLED_STORAGE_KEY, true));
  const commandPollRunningRef = useRef(false);
  const commandTableWarningShownRef = useRef(false);
  const processedCommandIdsRef = useRef(new Set());
  const chatEndRef = useRef(null);
  const musicRef = useRef(null);
  const actionSoundRef = useRef(null);
  const musicEnabledRef = useRef(musicEnabled);
  const soundsEnabledRef = useRef(soundsEnabled);

  const availableScenes = scenes && Object.keys(scenes).length ? scenes : DEFAULT_SCENES;
  const availableAvatars = avatars && avatars.length ? avatars : DEFAULT_AVATARS;
  const ownCharacter = profile.character || 'yogi';
  const partnerCharacter = partnerProfile?.character || '';
  const displayCharacter = partnerCharacter || ownCharacter;
  const receiverId = pair.user_one_id === user.id ? pair.user_two_id : pair.user_one_id;

  useEffect(() => {
    setDisplayNameDraft(profile.display_name || '');
  }, [profile.display_name]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  const getPartnerName = () => {
    const savedName = String(partnerProfile?.display_name || '').trim();
    if (savedName) return savedName;

    return partnerCharacter
      ? getAvatarName(partnerCharacter, availableAvatars)
      : 'Your partner';
  };

  const startMusic = async () => {
    const music = musicRef.current;
    if (!music) return false;

    try {
      music.volume = 0.45;
      music.muted = false;
      await music.play();
      return true;
    } catch (error) {
      console.warn('Could not start background music:', error);
      return false;
    }
  };

  const handleMusicToggle = async () => {
    const nextEnabled = !musicEnabled;
    setMusicEnabled(nextEnabled);
    saveBooleanPreference(MUSIC_ENABLED_STORAGE_KEY, nextEnabled);

    if (!nextEnabled) {
      musicRef.current?.pause();
      showToast('Music off.');
      return;
    }

    const started = await startMusic();
    showToast(started ? 'Music on.' : 'Tap again to start music.');
  };

  const handleSoundsToggle = () => {
    const nextEnabled = !soundsEnabled;
    setSoundsEnabled(nextEnabled);
    soundsEnabledRef.current = nextEnabled;
    saveBooleanPreference(SOUNDS_ENABLED_STORAGE_KEY, nextEnabled);

    if (!nextEnabled) {
      actionSoundRef.current?.pause();
      showToast('Sounds off.');
      return;
    }

    showToast('Sounds on.');
  };

  const playActionSound = async (actionName) => {
    if (!soundsEnabledRef.current || typeof Audio === 'undefined') return;

    const soundSrc = ACTION_SOUND_SOURCES[actionName];
    if (!soundSrc) return;

    try {
      actionSoundRef.current?.pause();
      const sound = new Audio(soundSrc);
      actionSoundRef.current = sound;
      sound.volume = 0.85;
      await sound.play();
    } catch (error) {
      console.warn(`Could not play ${actionName} sound:`, error);
    }
  };

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    soundsEnabledRef.current = soundsEnabled;
  }, [soundsEnabled]);

  useEffect(() => {
    let pauseHandle;
    let resumeHandle;

    const pauseMusicForBackground = () => {
      musicRef.current?.pause();
    };

    const resumeMusicIfEnabled = () => {
      if (musicEnabledRef.current) {
        startMusic();
      }
    };

    const setupAppMusicListeners = async () => {
      try {
        pauseHandle = await CapacitorApp.addListener('pause', pauseMusicForBackground);
        resumeHandle = await CapacitorApp.addListener('resume', resumeMusicIfEnabled);
      } catch (error) {
        console.warn('Could not attach app music listeners:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseMusicForBackground();
        return;
      }

      resumeMusicIfEnabled();
    };

    setupAppMusicListeners();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', pauseMusicForBackground);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', pauseMusicForBackground);
      pauseHandle?.remove?.();
      resumeHandle?.remove?.();
    };
  }, []);

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;

    music.loop = true;
    music.volume = 0.45;

    if (!musicEnabled) {
      music.pause();
      return;
    }

    music.play().catch((error) => {
      console.warn('Background music play was blocked:', error);
    });
  }, [musicEnabled]);

  useEffect(() => {
    const storedScene = getStoredScene(pair.id, user.id);
    setActiveScene(storedScene || 'home');
  }, [pair.id, user.id]);

  const handleIncomingAction = async (actionName, { notify = false } = {}) => {
    const partnerName = getPartnerName();
    setCurrentAnimation(actionName);
    playActionSound(actionName);
    showToast(`${partnerName} sent a ${actionName}!`);

    if (!notify) return;

    try {
      await sendLocalActionNotification({ partnerName, actionName });
    } catch (error) {
      console.log('Could not schedule local action notification.', error);
    }
  };

  const handleIncomingScene = async (sceneId, { notify = false } = {}) => {
    const nextSceneData = availableScenes[sceneId] || DEFAULT_SCENES[sceneId] || { id: sceneId, name: sceneId };
    const partnerName = getPartnerName();
    const sceneNotificationBody = `${partnerName} changed your scene to ${nextSceneData.name}! 🏞️`;

    setActiveScene(sceneId);
    saveStoredScene(pair.id, user.id, sceneId);
    showToast(sceneNotificationBody);

    if (!notify) return;

    try {
      await sendLocalActionNotification({
        partnerName,
        actionName: nextSceneData.name,
        notificationBody: sceneNotificationBody,
      });
    } catch (error) {
      console.log('Could not schedule local scene notification.', error);
    }
  };

  const applyIncomingCommand = async (command, { markHandled = true, notify = false } = {}) => {
    if (!command?.command_name) return;
    if (command.sender_id && String(command.sender_id) === String(user.id)) return;
    if (command.pair_id && String(command.pair_id) !== String(pair.id)) return;
    if (command.id && processedCommandIdsRef.current.has(command.id)) return;

    if (command.id) processedCommandIdsRef.current.add(command.id);

    if (command.command_type === 'scene') {
      await handleIncomingScene(command.command_name, { notify });
    } else {
      await handleIncomingAction(command.command_name, { notify });
    }

    if (markHandled && command.id) {
      const { error } = await supabase
        .from('pair_commands')
        .update({ handled_at: new Date().toISOString() })
        .eq('id', command.id)
        .eq('receiver_id', user.id);

      if (error) console.warn('Could not mark command handled:', error.message);
    }
  };

  const pollCommandInbox = async () => {
    if (!pair?.id || !user?.id || commandPollRunningRef.current) return;

    commandPollRunningRef.current = true;

    const { data, error } = await supabase
      .from('pair_commands')
      .select('*')
      .eq('pair_id', pair.id)
      .eq('receiver_id', user.id)
      .is('handled_at', null)
      .order('created_at', { ascending: true })
      .limit(15);

    commandPollRunningRef.current = false;

    if (error) {
      console.warn('Could not poll command inbox:', error.message);
      if (!commandTableWarningShownRef.current) {
        commandTableWarningShownRef.current = true;
        showToast(`Command inbox missing or blocked: ${error.message}`);
      }
      return;
    }

    commandTableWarningShownRef.current = false;

    for (const command of data || []) {
      await applyIncomingCommand(command, { markHandled: true, notify: false });
    }
  };

  const markChatRead = async () => {
    if (!pair?.id || !user?.id) return;

    const { error } = await supabase
      .from('pair_chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('pair_id', pair.id)
      .eq('receiver_id', user.id)
      .is('read_at', null);

    if (error) console.warn('Could not mark chat read:', error.message);
  };

  const loadChatMessages = async ({ quiet = false } = {}) => {
    if (!pair?.id || !user?.id) return;
    if (!quiet) setChatLoading(true);

    const { data, error } = await supabase
      .from('pair_chat_messages')
      .select('*')
      .eq('pair_id', pair.id)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
      .limit(80);

    if (!quiet) setChatLoading(false);

    if (error) {
      console.warn('Could not load chat messages:', error.message);
      if (chatOpen) showToast(`Chat unavailable: ${error.message}`);
      return;
    }

    const messages = data || [];
    setChatMessages(messages);

    const unreadCount = messages.filter((message) =>
      message.receiver_id === user.id && !message.read_at
    ).length;

    setUnreadChatCount(chatOpen ? 0 : unreadCount);

    if (chatOpen && unreadCount > 0) {
      await markChatRead();
      setUnreadChatCount(0);
    }
  };

  const sendChatMessage = async (event) => {
    event?.preventDefault?.();

    const body = chatDraft.trim();
    if (!body) return;

    if (!receiverId) {
      showToast('No connected partner to message.');
      return;
    }

    setChatSending(true);

    const { error } = await supabase.from('pair_chat_messages').insert([{
      pair_id: pair.id,
      sender_id: user.id,
      receiver_id: receiverId,
      body,
    }]);

    setChatSending(false);

    if (error) {
      console.warn('Could not send chat message:', error.message);
      showToast(`Message failed: ${error.message}`);
      return;
    }

    setChatDraft('');

    await sendClosedAppPush({
      actionName: 'chat',
      eventType: 'chat',
      notificationLabel: 'message',
      eventAt: new Date().toISOString(),
    });

    await loadChatMessages({ quiet: true });
  };

  const handleChatToggle = () => {
    setChatOpen((open) => !open);
    setSettingsOpen(false);
  };

  useEffect(() => {
    setupLocalNotifications();
    pollCommandInbox();

    const pollTimer = window.setInterval(pollCommandInbox, 1500);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') pollCommandInbox();
    };

    window.addEventListener('focus', pollCommandInbox);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener('focus', pollCommandInbox);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [pair.id, user.id, displayCharacter]);

  useEffect(() => {
    loadChatMessages({ quiet: true });
    const chatTimer = window.setInterval(() => loadChatMessages({ quiet: true }), 2500);

    return () => window.clearInterval(chatTimer);
  }, [pair.id, user.id, chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;

    markChatRead();
    setUnreadChatCount(0);
    window.setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  }, [chatOpen, chatMessages.length]);

  useEffect(() => {
    const replayPendingPushEvent = async () => {
      if (typeof window === 'undefined') return;

      try {
        const pendingRaw = window.localStorage.getItem(PENDING_PUSH_EVENT_KEY);
        if (!pendingRaw) return;

        const pending = JSON.parse(pendingRaw);
        if (String(pending.pairId) !== String(pair.id)) return;
        if (String(pending.senderId) === String(user.id)) return;

        if (pending.eventType === 'chat') {
          await loadChatMessages({ quiet: true });
          window.localStorage.removeItem(PENDING_PUSH_EVENT_KEY);
          return;
        }

        await applyIncomingCommand({
          id: `push-${pending.eventAt || pending.receivedAt || Date.now()}`,
          pair_id: pending.pairId,
          sender_id: pending.senderId,
          receiver_id: user.id,
          command_type: pending.eventType === 'scene' ? 'scene' : 'action',
          command_name: pending.actionName,
        }, { markHandled: false, notify: false });

        window.localStorage.removeItem(PENDING_PUSH_EVENT_KEY);
      } catch (error) {
        console.warn('Could not replay pending push event:', error);
      }
    };

    replayPendingPushEvent();
  }, [pair.id, user.id, displayCharacter]);

  useEffect(() => {
    const handlePushEvent = (event) => {
      const detail = event.detail || {};
      if (String(detail.pairId) !== String(pair.id)) return;
      if (String(detail.senderId) === String(user.id)) return;

      if (detail.eventType === 'chat') {
        loadChatMessages({ quiet: true });
        return;
      }

      applyIncomingCommand({
        id: `push-${detail.eventAt || detail.receivedAt || Date.now()}`,
        pair_id: detail.pairId,
        sender_id: detail.senderId,
        receiver_id: user.id,
        command_type: detail.eventType === 'scene' ? 'scene' : 'action',
        command_name: detail.actionName,
      }, { markHandled: false, notify: false });
    };

    window.addEventListener('bearbond-push-event', handlePushEvent);
    return () => window.removeEventListener('bearbond-push-event', handlePushEvent);
  }, [pair.id, user.id, displayCharacter]);

  useEffect(() => {
    const pairSub = supabase.channel(`pair_updates_${pair.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `id=eq.${pair.id}` },
      (payload) => {
        const updatedPair = payload.new;

        if (updatedPair.user_one_id !== user.id && updatedPair.user_two_id !== user.id) {
          showToast('Pairing was reset.');
          if (onPairReset) onPairReset();
          return;
        }

        setIsPartnerConnected(!!updatedPair.user_two_id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pairs', filter: `id=eq.${pair.id}` },
      () => {
        showToast('Pairing was reset.');
        if (onPairReset) onPairReset();
      }).subscribe();

    const chatSub = supabase.channel(`pair_chat_${pair.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pair_chat_messages', filter: `pair_id=eq.${pair.id}` },
      () => loadChatMessages({ quiet: true }))
      .subscribe();

    return () => {
      supabase.removeChannel(pairSub);
      supabase.removeChannel(chatSub);
    };
  }, [pair.id, user.id, onPairReset, chatOpen]);

  useEffect(() => {
    if (!secretTapCount) return undefined;

    const resetTapTimer = setTimeout(() => setSecretTapCount(0), 1800);
    return () => clearTimeout(resetTapTimer);
  }, [secretTapCount]);

  const sendClosedAppPush = async ({ actionName, eventType = 'action', notificationLabel, eventAt }) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-action-push', {
        body: {
          pairId: pair.id,
          senderId: user.id,
          actionName,
          eventType,
          notificationLabel,
          eventAt,
        },
      });

      if (error) {
        const detailedMessage = await getEdgeFunctionErrorMessage(error);
        console.warn('Could not send push notification:', detailedMessage, error);
        return false;
      }

      if (data?.skipped) {
        console.warn('Push notification skipped:', data.reason);
        return false;
      }

      if (data?.error) {
        const dataMessage = describeFunctionPayload(data) || data.error;
        console.warn('Push notification error:', trimPushError(dataMessage));
        return false;
      }

      return true;
    } catch (error) {
      const detailedMessage = await getEdgeFunctionErrorMessage(error);
      console.warn('Could not send push notification:', detailedMessage, error);
      return false;
    }
  };

  const sendDirectCommand = async ({ commandType, commandName }) => {
    if (!receiverId) {
      showToast('No connected partner to send to.');
      return false;
    }

    const { error } = await supabase.from('pair_commands').insert([{
      pair_id: pair.id,
      sender_id: user.id,
      receiver_id: receiverId,
      command_type: commandType,
      command_name: commandName,
    }]);

    if (error) {
      console.warn('Could not send direct command:', error.message);
      showToast(`Command failed: ${error.message}`);
      return false;
    }

    return true;
  };

  const handleSendAction = async (actionId) => {
    setCurrentAnimation(actionId);
    playActionSound(actionId);
    const now = new Date().toISOString();

    const commandSent = await sendDirectCommand({ commandType: 'action', commandName: actionId });
    if (!commandSent) return;

    showToast('Action sent to partner.');

    supabase.from('pairs').update({
      last_action: actionId,
      last_action_from: user.id,
      last_action_at: now,
    }).eq('id', pair.id).then(({ error }) => {
      if (error) console.warn('Could not update pair last action:', error.message);
    });

    await sendClosedAppPush({ actionName: actionId, eventType: 'action', eventAt: now });
  };

  const handleChangeScene = async (e) => {
    const newScene = e.target.value;
    if (!newScene) return;

    const nextSceneData = availableScenes[newScene] || DEFAULT_SCENES[newScene];
    if (!nextSceneData) {
      showToast('Scene not found.');
      setScenePickerValue('');
      return;
    }

    const sceneName = nextSceneData.name || 'Scene';
    const now = new Date().toISOString();

    setScenePickerValue(newScene);

    const commandSent = await sendDirectCommand({ commandType: 'scene', commandName: newScene });
    setScenePickerValue('');

    if (!commandSent) return;

    await sendClosedAppPush({
      actionName: newScene,
      eventType: 'scene',
      notificationLabel: sceneName,
      eventAt: now,
    });

    showToast(`Scene sent to partner: ${sceneName}`);
  };

  const handleDisplayNameSave = async () => {
    const cleanName = displayNameDraft.trim().slice(0, 40);

    if (!onDisplayNameChange) {
      showToast('Name setting is not available.');
      return;
    }

    setDisplayNameSaving(true);
    const saved = await onDisplayNameChange(cleanName);
    setDisplayNameSaving(false);

    showToast(saved
      ? `Notifications will come from ${cleanName || 'your avatar name'}.`
      : 'Could not save your name.'
    );
  };

  const handleAvatarSelect = async (avatarId) => {
    if (avatarId === ownCharacter) return;

    if (!onAvatarChange) {
      showToast('Avatar picker is not available.');
      return;
    }

    const changed = await onAvatarChange(avatarId);

    if (!changed) {
      showToast('Could not change avatar.');
      return;
    }

    setCurrentAnimation('idle');
    showToast(`Your avatar changed to ${getAvatarName(avatarId, availableAvatars)}.`);
  };

  const handleRemainLoggedInChange = (e) => {
    const shouldRemainLoggedIn = e.target.checked;
    setRemainLoggedIn(shouldRemainLoggedIn);
    setRemainLoggedInPreference(shouldRemainLoggedIn);
    showToast(shouldRemainLoggedIn ? 'You will stay logged in!' : 'Session-only login enabled!');
  };

  const handleLogout = async () => {
    setSettingsOpen(false);
    if (onLogout) {
      await onLogout();
      return;
    }

    await supabase.auth.signOut();
  };

  const handleSecretLogoTap = () => {
    const nextTapCount = secretTapCount + 1;
    setSecretTapCount(nextTapCount);

    if (nextTapCount >= 5) {
      setSecretTapCount(0);
      setSettingsOpen(false);
      setAdminOpen(true);
    }
  };

  const performChangeCharacter = async () => {
    setConfirmDialog(null);
    setSettingsOpen(false);
    if (onCharacterChange) await onCharacterChange();
  };

  const handleChangeCharacterClick = () => {
    setConfirmDialog({
      title: 'Open Avatar Picker?',
      message: 'This keeps your current pairing and sends you back to the full avatar picker.',
      confirmLabel: 'Choose',
      onConfirm: performChangeCharacter,
    });
  };

  const performRepair = async () => {
    setConfirmDialog(null);
    setSettingsOpen(false);

    await supabase.from('pair_commands').delete().eq('pair_id', pair.id);
    await supabase.from('pair_chat_messages').delete().eq('pair_id', pair.id);
    await supabase.from('pair_events').delete().eq('pair_id', pair.id);

    const resetPayload = {
      user_two_id: null,
      active_scene: 'home',
      last_action: null,
      last_action_from: null,
      last_action_at: null,
      last_scene: null,
      last_scene_from: null,
      last_scene_at: null,
    };

    const { error } = pair.user_one_id === user.id
      ? await supabase.from('pairs').delete().eq('id', pair.id)
      : await supabase.from('pairs').update(resetPayload).eq('id', pair.id);

    if (error) {
      showToast(`Could not re-pair: ${error.message}`);
      return;
    }

    if (onPairReset) onPairReset();
  };

  const handleRepairClick = () => {
    setConfirmDialog({
      title: 'Re-pair Partner?',
      message: 'This leaves the current pair and sends you back to the pairing screen. Your chosen avatar stays saved.',
      confirmLabel: 'Re-pair',
      onConfirm: performRepair,
    });
  };

  const handleConfirm = async () => {
    if (!confirmDialog?.onConfirm) return;
    await confirmDialog.onConfirm();
  };

  const currentSceneData =
    availableScenes[activeScene] ||
    DEFAULT_SCENES[activeScene] ||
    availableScenes.home ||
    DEFAULT_SCENES.home;

  return (
    <div className="main-scene" style={{ backgroundImage: `url(${currentSceneData.image})` }}>
      <audio ref={musicRef} src={BACKGROUND_MUSIC_SRC} loop preload="auto" />

      <div className="top-bar">
        <div className="status-badge">
          {isPartnerConnected ? '🟢 Connected' : '🔴 Waiting...'}
        </div>

        <button
          onClick={handleSecretLogoTap}
          className="secret-logo-btn"
          aria-label="BearBond logo"
        >
          <img src={logoImg} alt="BearBond" className="top-logo" />
        </button>

        <div style={{ display: 'flex', gap: '0.45rem', justifySelf: 'end', alignItems: 'center' }}>
          <button
            onClick={handleMusicToggle}
            className="icon-btn"
            aria-label={musicEnabled ? 'Turn music off' : 'Turn music on'}
            title={musicEnabled ? 'Music off' : 'Music on'}
          >
            {musicEnabled ? '🔊' : '🔇'}
          </button>
          <button
            onClick={handleSoundsToggle}
            className="icon-btn"
            aria-label={soundsEnabled ? 'Turn action sounds off' : 'Turn action sounds on'}
            title={soundsEnabled ? 'Sounds off' : 'Sounds on'}
          >
            {soundsEnabled ? '🔔' : '🔕'}
          </button>
          <button
            onClick={() => setSettingsOpen((open) => !open)}
            className="icon-btn"
            aria-label="Open settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleChatToggle}
        className="chat-fab pixel-btn"
        aria-label="Open chat"
      >
        💬
        {unreadChatCount > 0 && <span className="chat-unread-badge">{unreadChatCount}</span>}
      </button>

      <div className="scene-selector-wrapper scene-selector-top">
        <label className="scene-select-label" htmlFor="scene-select">
          Send Scene to Partner
        </label>
        <div className="scene-select-frame">
          <select id="scene-select" value={scenePickerValue} onChange={handleChangeScene} className="pixel-select">
            <option value="">Choose Scene</option>
            {Object.values(availableScenes).map(scene => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
          <span className="scene-select-arrow" aria-hidden="true">▼</span>
        </div>
      </div>

      {settingsOpen && (
        <div className="settings-popover">
          <h2 className="settings-title">Settings</h2>

          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              setAdminOpen(true);
            }}
            className="pixel-btn secondary settings-start-over-btn"
          >
            Registered Users
          </button>

          <div className="setting-toggle-row" style={{ alignItems: 'stretch', flexDirection: 'column', gap: '0.55rem' }}>
            <span className="setting-toggle-copy">
              <span className="setting-toggle-label">Who am I?</span>
              <span className="setting-toggle-hint">This name is used in your partner's notifications and action messages.</span>
            </span>
            <input
              type="text"
              value={displayNameDraft}
              onChange={(e) => setDisplayNameDraft(e.target.value)}
              placeholder="Craig"
              maxLength={40}
              className="pixel-select"
              style={{ width: '100%' }}
            />
            <button
              type="button"
              onClick={handleDisplayNameSave}
              className="pixel-btn primary"
              disabled={displayNameSaving}
            >
              {displayNameSaving ? 'Saving...' : 'Save name'}
            </button>
          </div>
          <label className="setting-toggle-row">
            <input
              type="checkbox"
              checked={remainLoggedIn}
              onChange={handleRemainLoggedInChange}
              className="setting-checkbox"
            />
            <span className="setting-toggle-copy">
              <span className="setting-toggle-label">Remain logged in</span>
              <span className="setting-toggle-hint">Keep BearBond open after closing the app.</span>
            </span>
          </label>

          <label className="setting-toggle-row">
            <input
              type="checkbox"
              checked={musicEnabled}
              onChange={handleMusicToggle}
              className="setting-checkbox"
            />
            <span className="setting-toggle-copy">
              <span className="setting-toggle-label">Music</span>
              <span className="setting-toggle-hint">Loop the 8-bit background track.</span>
            </span>
          </label>

          <label className="setting-toggle-row">
            <input
              type="checkbox"
              checked={soundsEnabled}
              onChange={handleSoundsToggle}
              className="setting-checkbox"
            />
            <span className="setting-toggle-copy">
              <span className="setting-toggle-label">Action sounds</span>
              <span className="setting-toggle-hint">Play sound effects when actions arrive or are sent.</span>
            </span>
          </label>

          <div className="settings-avatar-picker">
            <span className="setting-toggle-label">Avatar</span>
            <div className="settings-avatar-grid">
              {availableAvatars.map((avatar) => (
                <button
                  type="button"
                  key={avatar.id}
                  className={`settings-avatar-card ${ownCharacter === avatar.id ? 'selected' : ''}`}
                  onClick={() => handleAvatarSelect(avatar.id)}
                >
                  <img src={avatar.preview} alt={avatar.name} />
                  <span>{avatar.name}</span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleChangeCharacterClick} className="pixel-btn primary settings-start-over-btn">
            Full Avatar Picker
          </button>
          <button onClick={handleRepairClick} className="pixel-btn secondary settings-start-over-btn">
            Re-pair Partner
          </button>
          <button onClick={handleLogout} className="pixel-btn danger settings-logout-btn">
            Log Out
          </button>
        </div>
      )}

      {chatOpen && (
        <div className="chat-panel pixel-panel">
          <div className="chat-panel-header">
            <div>
              <span className="chat-panel-eyebrow">BearBond Chat</span>
              <h2>{getPartnerName()}</h2>
            </div>
            <button type="button" onClick={() => setChatOpen(false)} className="chat-close-btn" aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className="chat-message-list">
            {chatLoading && <div className="chat-empty">Loading tiny letters...</div>}
            {!chatLoading && chatMessages.length === 0 && (
              <div className="chat-empty">No messages yet. Send the first bear note.</div>
            )}

            {chatMessages.map((message) => {
              const mine = message.sender_id === user.id;
              return (
                <div key={message.id} className={`chat-bubble-row ${mine ? 'mine' : 'theirs'}`}>
                  <div className="chat-bubble">
                    <p>{message.body}</p>
                    <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form className="chat-compose" onSubmit={sendChatMessage}>
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Type a bear note..."
              maxLength={500}
            />
            <button type="submit" className="pixel-btn primary" disabled={chatSending || !chatDraft.trim()}>
              {chatSending ? '...' : 'Send'}
            </button>
          </form>
        </div>
      )}

      {adminOpen && <AdminPanel user={user} profile={profile} onClose={() => setAdminOpen(false)} />}

      {toastMessage && <div className="toast-notification">{toastMessage}</div>}

      <div className="scene-center">
        <BearSprite
          currentAnimation={currentAnimation}
          onAnimationComplete={() => setCurrentAnimation('idle')}
          character={displayCharacter}
          avatarSprites={avatarSprites}
        />
      </div>

      <div className="ui-layer bottom-ui">
        <div className="action-grid">
          {ACTIONS.map(action => (
            <button key={action.id} className="action-btn" onClick={() => handleSendAction(action.id)}>
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {confirmDialog && (
        <div className="pixel-alert-overlay start-again-confirm-overlay">
          <div className="pixel-alert-box start-again-confirm-box">
            <h3 className="admin-confirm-title">{confirmDialog.title}</h3>
            <p className="pixel-alert-message">{confirmDialog.message}</p>
            <div className="pixel-alert-actions">
              <button onClick={() => setConfirmDialog(null)} className="pixel-btn secondary">
                Cancel
              </button>
              <button onClick={handleConfirm} className="pixel-btn primary">
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}