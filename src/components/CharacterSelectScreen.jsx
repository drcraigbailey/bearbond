import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AVATARS, getAvatarName } from '../data/avatarSets';

const getPairTimestamp = (item) => {
  const timestamps = [
    item?.last_action_at,
    item?.last_scene_at,
    item?.updated_at,
    item?.created_at,
  ]
    .map((value) => value ? Date.parse(value) : 0)
    .filter((value) => Number.isFinite(value));

  return Math.max(0, ...timestamps);
};

const chooseActivePair = (pairs, userId) => {
  if (!Array.isArray(pairs)) return null;

  return pairs
    .filter((item) => item && item.user_one_id && item.user_two_id)
    .filter((item) => item.user_one_id === userId || item.user_two_id === userId)
    .sort((a, b) => getPairTimestamp(b) - getPairTimestamp(a))[0] || null;
};

const sendAvatarToPartner = async ({ user, avatarId, avatars }) => {
  if (!user?.id || !avatarId) return false;

  const { data: pairs, error: pairError } = await supabase
    .from('pairs')
    .select('*')
    .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`);

  if (pairError) {
    console.warn('Could not find pair for avatar update:', pairError.message);
    return false;
  }

  const pair = chooseActivePair(pairs || [], user.id);
  if (!pair?.id) return false;

  const receiverId = pair.user_one_id === user.id ? pair.user_two_id : pair.user_one_id;
  if (!receiverId) return false;

  const { error: commandError } = await supabase.from('pair_commands').insert([{
    pair_id: pair.id,
    sender_id: user.id,
    receiver_id: receiverId,
    command_type: 'avatar',
    command_name: avatarId,
  }]);

  if (commandError) {
    console.warn('Could not send avatar command:', commandError.message);
    return false;
  }

  const avatarName = getAvatarName(avatarId, avatars);
  const now = new Date().toISOString();

  supabase.functions.invoke('send-action-push', {
    body: {
      pairId: pair.id,
      senderId: user.id,
      actionName: avatarId,
      eventType: 'avatar',
      notificationLabel: avatarName,
      eventAt: now,
    },
  }).then(({ data, error }) => {
    if (error) {
      console.warn('Could not send avatar push notification:', error.message || error);
    } else if (data?.error) {
      console.warn('Avatar push notification error:', data.error);
    }
  }).catch((error) => {
    console.warn('Could not send avatar push notification:', error);
  });

  return true;
};

export default function CharacterSelectScreen({ user, onComplete, avatars = AVATARS }) {
  const [loading, setLoading] = useState(false);

  const selectCharacter = async (charName) => {
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email, character: charName });

    if (error) {
      console.warn('Could not save selected avatar:', error.message);
      setLoading(false);
      return;
    }

    await sendAvatarToPartner({ user, avatarId: charName, avatars });
    onComplete(charName);
  };

  return (
    <div className="auth-screen screen-padding">
      <h2 className="pixel-title">Choose your avatar</h2>
      <p className="subtitle">Your partner will see this character.</p>

      <div className="character-select-grid avatar-select-grid">
        {avatars.map((avatar) => (
          <button
            type="button"
            key={avatar.id}
            className="char-card avatar-choice-card"
            onClick={() => !loading && selectCharacter(avatar.id)}
            disabled={loading}
          >
            <img src={avatar.preview || avatar.preview_url || avatar.idle_url} alt={avatar.name} className="char-preview" />
            <p className="pixel-title" style={{ fontSize: '1rem', marginTop: '1rem' }}>
              {avatar.name.toUpperCase()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
