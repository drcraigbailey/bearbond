import { useState, useEffect } from 'react';
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

const sendLocalActionNotification = async ({ partnerName, actionName }) => {
  const canNotify = await setupLocalNotifications();

  if (!canNotify) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        title: 'BearBond',
        body: `${partnerName} just sent you a ${actionName}! ❤️`,
        id: Math.floor(Date.now() % 2147483647),
        channelId: BEARBOND_NOTIFICATION_CHANNEL,
        autoCancel: true,
      }
    ]
  });
};

export default function MainBearScene({ user, pair, profile, onPairReset, onCharacterChange }) {
  const [activeScene, setActiveScene] = useState(pair.active_scene || 'home');
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [toastMessage, setToastMessage] = useState('');
  const [isPartnerConnected, setIsPartnerConnected] = useState(!!pair.user_two_id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [remainLoggedIn, setRemainLoggedIn] = useState(getRemainLoggedInPreference());
  const [confirmDialog, setConfirmDialog] = useState(null);

  // If I picked Yogi, display Craig. If I picked Craig, display Yogi.
  const displayCharacter = profile.character === 'yogi' ? 'craig' : 'yogi';

  useEffect(() => {
    setupLocalNotifications();

    // 1. Subscribe to Room changes (Scene changes & partner joining)
    const pairSub = supabase.channel(`pair_updates_${pair.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `id=eq.${pair.id}` }, 
      (payload) => {
        if (payload.new.user_one_id !== user.id && payload.new.user_two_id !== user.id) {
          showToast('Pairing was reset.');
          if (onPairReset) onPairReset();
          return;
        }

        if (payload.new.active_scene !== activeScene) {
          setActiveScene(payload.new.active_scene);
        }

        setIsPartnerConnected(!!payload.new.user_two_id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pairs', filter: `id=eq.${pair.id}` }, 
      () => {
        showToast('Pairing was reset.');
        if (onPairReset) onPairReset();
      }).subscribe();

    // 2. Subscribe to Action Events
    const eventSub = supabase.channel(`pair_events_${pair.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pair_events', filter: `pair_id=eq.${pair.id}` }, 
      async (payload) => {
        const event = payload.new;
        
        // If the partner sent an action
        if (event.sender_id !== user.id && event.event_type === 'action') {
          setCurrentAnimation(event.action_name);
          
          // Show in-app pixel toast
          const partnerName = displayCharacter.charAt(0).toUpperCase() + displayCharacter.slice(1);
          showToast(`${partnerName} sent a ${event.action_name}!`);

          // Trigger Native Android System Notification while the app is active/backgrounded
          try {
            await sendLocalActionNotification({ partnerName, actionName: event.action_name });
          } catch (error) {
            console.log('Could not schedule local notification.', error);
          }
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(pairSub);
      supabase.removeChannel(eventSub);
    };
  }, [pair.id, user.id, activeScene, displayCharacter, onPairReset]);

  useEffect(() => {
    if (!secretTapCount) return undefined;

    const resetTapTimer = setTimeout(() => setSecretTapCount(0), 1800);
    return () => clearTimeout(resetTapTimer);
  }, [secretTapCount]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const sendClosedAppPush = async (actionId) => {
    try {
      await supabase.functions.invoke('send-action-push', {
        body: {
          pairId: pair.id,
          senderId: user.id,
          actionName: actionId,
        },
      });
    } catch (error) {
      console.warn('Could not send push notification:', error);
    }
  };

  const handleSendAction = async (actionId) => {
    // Play the animation immediately on our screen too
    setCurrentAnimation(actionId);
    
    // Save to DB to trigger partner's app
    await supabase.from('pair_events').insert([{
      pair_id: pair.id,
      sender_id: user.id,
      event_type: 'action',
      action_name: actionId
    }]);

    await supabase.from('pairs').update({
      last_action: actionId,
      last_action_from: user.id,
      last_action_at: new Date().toISOString()
    }).eq('id', pair.id);

    sendClosedAppPush(actionId);
  };

  const handleChangeScene = async (e) => {
    const newScene = e.target.value;
    setActiveScene(newScene);
    await supabase.from('pairs').update({ active_scene: newScene }).eq('id', pair.id);
  };

  const handleRemainLoggedInChange = (e) => {
    const shouldRemainLoggedIn = e.target.checked;
    setRemainLoggedIn(shouldRemainLoggedIn);
    setRemainLoggedInPreference(shouldRemainLoggedIn);
    showToast(shouldRemainLoggedIn ? 'You will stay logged in!' : 'Session-only login enabled!');
  };

  const handleLogout = async () => {
    setSettingsOpen(false);
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
      confirmLabel: 'Choose Character',
      onConfirm: performChangeCharacter,
    });
  };

  const performRepair = async () => {
    setConfirmDialog(null);
    setSettingsOpen(false);

    await supabase.from('pair_events').delete().eq('pair_id', pair.id);

    const resetPayload = {
      user_two_id: null,
      active_scene: 'home',
      last_action: null,
      last_action_from: null,
      last_action_at: null,
    };

    const { error, data: updatedPair } = pair.user_one_id === user.id
      ? await supabase.from('pairs').delete().eq('id', pair.id).select().maybeSingle()
      : await supabase.from('pairs').update(resetPayload).eq('id', pair.id).select().maybeSingle();

    if (error) {
      showToast(`Could not re-pair: ${error.message}`);
      return;
    }

    if (pair.user_one_id === user.id || !updatedPair) {
      if (onPairReset) onPairReset();
      return;
    }

    setIsPartnerConnected(!!updatedPair.user_two_id);
    showToast('You left this pair. Your partner can wait for a new connection.');
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
        <select value={activeScene} onChange={handleChangeScene} className="pixel-select">
          {Object.values(SCENES).map(scene => (
            <option key={scene.id} value={scene.id}>{scene.name}</option>
          ))}
        </select>
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
        {/* Pass the displayCharacter prop down to the BearSprite engine */}
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
