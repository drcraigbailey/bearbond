import { useState, useEffect, useRef } from 'react';
import { supabase, getRemainLoggedInPreference, setRemainLoggedInPreference } from '../lib/supabaseClient';
import { LocalNotifications } from '@capacitor/local-notifications';
import BearSprite from './BearSprite';
import AdminPanel from './AdminPanel';
import { SCENES } from '../data/scenes';
import { ACTIONS } from '../data/actions';
import logoImg from '../assets/bear/main.png';

const BEARBOND_NOTIFICATION_CHANNEL = 'bearbond-actions';

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
      }
    ]
  });
};

const trimPushError = (message) => {
  if (!message) return 'Function error';
  return String(message).slice(0, 180);
};

const describeFunctionPayload = (payload) => {
  if (!payload) return '';

  if (payload.details?.error?.message) {
    return `${payload.error || 'Firebase error'}: ${payload.details.error.message}`;
  }

  if (payload.details?.message) {
    return `${payload.error || 'Firebase error'}: ${payload.details.message}`;
  }

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
    // Fall back to the generic error below.
  }

  return trimPushError(error?.message || 'Function error');
};

export default function MainBearScene({ user, pair, profile, onPairReset, onCharacterChange, onLogout }) {
  const [activeScene, setActiveScene] = useState(pair.active_scene || 'home');
  const [scenePickerValue, setScenePickerValue] = useState('');
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [toastMessage, setToastMessage] = useState('');
  const [isPartnerConnected, setIsPartnerConnected] = useState(!!pair.user_two_id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [remainLoggedIn, setRemainLoggedIn] = useState(getRemainLoggedInPreference());
  const [confirmDialog, setConfirmDialog] = useState(null);
  const lastSeenActionAtRef = useRef(pair.last_action_at || null);
  const lastSeenSceneAtRef = useRef(pair.last_scene_at || null);

  // If I picked Yogi, display Craig. If I picked Craig, display Yogi.
  const displayCharacter = profile.character === 'yogi' ? 'craig' : 'yogi';

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5000);
  };

  const getPartnerName = () => displayCharacter.charAt(0).toUpperCase() + displayCharacter.slice(1);

  const handleIncomingAction = async (actionName) => {
    const partnerName = getPartnerName();
    setCurrentAnimation(actionName);
    showToast(`${partnerName} sent a ${actionName}!`);

    try {
      await sendLocalActionNotification({ partnerName, actionName });
    } catch (error) {
      console.log('Could not schedule local notification.', error);
    }
  };

  const handleIncomingScene = async (sceneId) => {
    const nextSceneData = SCENES[sceneId];
    if (!nextSceneData) return;

    const partnerName = getPartnerName();
    const sceneNotificationBody = `${partnerName} changed your scene to ${nextSceneData.name}! 🏞️`;

    setActiveScene(sceneId);
    showToast(sceneNotificationBody);

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

  useEffect(() => {
    setupLocalNotifications();

    const pairSub = supabase.channel(`pair_updates_${pair.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `id=eq.${pair.id}` }, 
      async (payload) => {
        const updatedPair = payload.new;

        if (updatedPair.user_one_id !== user.id && updatedPair.user_two_id !== user.id) {
          showToast('Pairing was reset.');
          if (onPairReset) onPairReset();
          return;
        }

        setIsPartnerConnected(!!updatedPair.user_two_id);

        if (
          updatedPair.last_action &&
          updatedPair.last_action_from !== user.id &&
          updatedPair.last_action_at &&
          updatedPair.last_action_at !== lastSeenActionAtRef.current
        ) {
          lastSeenActionAtRef.current = updatedPair.last_action_at;
          await handleIncomingAction(updatedPair.last_action);
        }

        if (
          updatedPair.last_scene &&
          updatedPair.last_scene_from !== user.id &&
          updatedPair.last_scene_at &&
          updatedPair.last_scene_at !== lastSeenSceneAtRef.current
        ) {
          lastSeenSceneAtRef.current = updatedPair.last_scene_at;
          await handleIncomingScene(updatedPair.last_scene);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pairs', filter: `id=eq.${pair.id}` }, 
      () => {
        showToast('Pairing was reset.');
        if (onPairReset) onPairReset();
      }).subscribe();

    return () => {
      supabase.removeChannel(pairSub);
    };
  }, [pair.id, user.id, displayCharacter, onPairReset]);

  useEffect(() => {
    if (!secretTapCount) return undefined;

    const resetTapTimer = setTimeout(() => setSecretTapCount(0), 1800);
    return () => clearTimeout(resetTapTimer);
  }, [secretTapCount]);

  const sendClosedAppPush = async ({ actionName, eventType = 'action', notificationLabel }) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-action-push', {
        body: {
          pairId: pair.id,
          senderId: user.id,
          actionName,
          eventType,
          notificationLabel,
        },
      });

      if (error) {
        const detailedMessage = await getEdgeFunctionErrorMessage(error);
        console.warn('Could not send push notification:', detailedMessage, error);
        showToast(`Push failed: ${detailedMessage}`);
        return false;
      }

      if (data?.skipped) {
        console.warn('Push notification skipped:', data.reason);
        showToast(`Push skipped: ${data.reason || 'No receiver token'}`);
        return false;
      }

      if (data?.error) {
        const dataMessage = describeFunctionPayload(data) || data.error;
        console.warn('Push notification error:', data);
        showToast(`Push failed: ${trimPushError(dataMessage)}`);
        return false;
      }

      return true;
    } catch (error) {
      const detailedMessage = await getEdgeFunctionErrorMessage(error);
      console.warn('Could not send push notification:', detailedMessage, error);
      showToast(`Push failed: ${detailedMessage}`);
      return false;
    }
  };

  const handleSendAction = async (actionId) => {
    setCurrentAnimation(actionId);
    const now = new Date().toISOString();
    lastSeenActionAtRef.current = now;

    supabase.from('pair_events').insert([{
      pair_id: pair.id,
      sender_id: user.id,
      event_type: 'action',
      action_name: actionId
    }]).then(({ error }) => {
      if (error) console.warn('Could not save action event:', error.message);
    });

    const { error } = await supabase.from('pairs').update({
      last_action: actionId,
      last_action_from: user.id,
      last_action_at: now
    }).eq('id', pair.id);

    if (error) {
      showToast(`Could not send action: ${error.message}`);
      return;
    }

    await sendClosedAppPush({ actionName: actionId, eventType: 'action' });
  };

  const handleChangeScene = async (e) => {
    const newScene = e.target.value;
    if (!newScene) return;

    const sceneName = SCENES[newScene]?.name || 'Scene';
    const now = new Date().toISOString();
    lastSeenSceneAtRef.current = now;

    setScenePickerValue(newScene);

    supabase.from('pair_events').insert([{
      pair_id: pair.id,
      sender_id: user.id,
      event_type: 'scene',
      action_name: newScene,
    }]).then(({ error }) => {
      if (error) console.warn('Could not save scene event:', error.message);
    });

    const { error } = await supabase.from('pairs').update({
      last_scene: newScene,
      last_scene_from: user.id,
      last_scene_at: now,
    }).eq('id', pair.id);

    setScenePickerValue('');

    if (error) {
      showToast(`Could not send scene: ${error.message}`);
      return;
    }

    await sendClosedAppPush({
      actionName: newScene,
      eventType: 'scene',
      notificationLabel: sceneName,
    });

    showToast(`Scene sent to partner: ${sceneName}`);
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
      title: 'Change Character?',
      message: 'This keeps your current pairing and sends you back to the character picker.',
      confirmLabel: 'Choose',
      onConfirm: performChangeCharacter,
    });
  };

  const performRepair = async () => {
    setConfirmDialog(null);
    setSettingsOpen(false);

    const { error: eventDeleteError } = await supabase
      .from('pair_events')
      .delete()
      .eq('pair_id', pair.id);

    if (eventDeleteError) {
      showToast(`Could not clear pair actions: ${eventDeleteError.message}`);
      return;
    }

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
      message: 'This leaves the current pair and sends you back to the pairing screen. Your chosen character stays saved.',
      confirmLabel: 'Re-pair',
      onConfirm: performRepair,
    });
  };

  const handleConfirm = async () => {
    if (!confirmDialog?.onConfirm) return;
    await confirmDialog.onConfirm();
  };

  const currentSceneData = SCENES[activeScene] || SCENES['home'];

  return (
    <div className="main-scene" style={{ backgroundImage: `url(${currentSceneData.image})` }}>
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

        <button
          onClick={() => setSettingsOpen((open) => !open)}
          className="icon-btn"
          aria-label="Open settings"
        >
          ⚙️
        </button>
      </div>

      <div className="scene-selector-wrapper scene-selector-top">
        <label className="scene-select-label" htmlFor="scene-select">
          Send Scene to Partner
        </label>
        <div className="scene-select-frame">
          <select id="scene-select" value={scenePickerValue} onChange={handleChangeScene} className="pixel-select">
            <option value="">Choose Scene</option>
            {Object.values(SCENES).map(scene => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
          <span className="scene-select-arrow" aria-hidden="true">▼</span>
        </div>
      </div>

      {settingsOpen && (
        <div className="settings-popover">
          <h2 className="settings-title">Settings</h2>
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
          <button onClick={handleChangeCharacterClick} className="pixel-btn primary settings-start-over-btn">
            Change Character
          </button>
          <button onClick={handleRepairClick} className="pixel-btn secondary settings-start-over-btn">
            Re-pair Partner
          </button>
          <button onClick={handleLogout} className="pixel-btn danger settings-logout-btn">
            Log Out
          </button>
        </div>
      )}

      {adminOpen && <AdminPanel user={user} profile={profile} onClose={() => setAdminOpen(false)} />}

      {toastMessage && <div className="toast-notification">{toastMessage}</div>}

      <div className="scene-center">
        <BearSprite 
          currentAnimation={currentAnimation} 
          onAnimationComplete={() => setCurrentAnimation('idle')} 
          character={displayCharacter} 
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
