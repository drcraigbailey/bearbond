import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LocalNotifications } from '@capacitor/local-notifications';
import BearSprite from './BearSprite';
import { SCENES } from '../data/scenes';
import { ACTIONS } from '../data/actions';

export default function MainBearScene({ user, pair, profile }) {
  const [activeScene, setActiveScene] = useState(pair.active_scene || 'home');
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [toastMessage, setToastMessage] = useState('');
  const [isPartnerConnected, setIsPartnerConnected] = useState(!!pair.user_two_id);

  // If I picked Yogi, display Craig. If I picked Craig, display Yogi.
  const displayCharacter = profile.character === 'yogi' ? 'craig' : 'yogi';

  useEffect(() => {
    // Request permission to send Android notifications
    const requestPermissions = async () => {
      try {
        await LocalNotifications.requestPermissions();
      } catch (e) {
        console.log("Not running on a native device, skipping notification permissions.");
      }
    };
    requestPermissions();

    // 1. Subscribe to Room changes (Scene changes & partner joining)
    const pairSub = supabase.channel(`pair_updates_${pair.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `id=eq.${pair.id}` }, 
      (payload) => {
        if (payload.new.active_scene !== activeScene) {
          setActiveScene(payload.new.active_scene);
        }
        if (payload.new.user_two_id) {
          setIsPartnerConnected(true);
        }
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

          // Trigger Native Android System Notification
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  title: "BearBond",
                  body: `${partnerName} just sent you a ${event.action_name}! ❤️`,
                  id: new Date().getTime(),
                  schedule: { at: new Date(Date.now() + 100) }, // Trigger immediately
                  smallIcon: "ic_stat_icon_config_sample", // Uses the default app icon
                }
              ]
            });
          } catch (e) {
            console.log("Local notifications only fire on native Android/iOS");
          }
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(pairSub);
      supabase.removeChannel(eventSub);
    };
  }, [pair.id, user.id, activeScene, displayCharacter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
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
  };

  const handleChangeScene = async (e) => {
    const newScene = e.target.value;
    setActiveScene(newScene);
    await supabase.from('pairs').update({ active_scene: newScene }).eq('id', pair.id);
  };

  const currentSceneData = SCENES[activeScene] || SCENES['home'];

  return (
    <div className="main-scene" style={{ backgroundImage: `url(${currentSceneData.image})` }}>
      <div className="top-bar">
        <div className="status-badge">
          {isPartnerConnected ? '🟢 Connected' : '🔴 Waiting...'}
        </div>
        <button onClick={() => supabase.auth.signOut()} className="icon-btn">⚙️</button>
      </div>

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
        
        <div className="scene-selector-wrapper">
          <select value={activeScene} onChange={handleChangeScene} className="pixel-select">
            {Object.values(SCENES).map(scene => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}