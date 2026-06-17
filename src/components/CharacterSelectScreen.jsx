import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AVATARS } from '../data/avatarSets';

export default function CharacterSelectScreen({ user, onComplete }) {
  const [loading, setLoading] = useState(false);

  const selectCharacter = async (charName) => {
    setLoading(true);

    await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email, character: charName });

    onComplete(charName);
  };

  return (
    <div className="auth-screen screen-padding">
      <h2 className="pixel-title">Choose your avatar</h2>
      <p className="subtitle">Your partner will see this character.</p>

      <div className="character-select-grid avatar-select-grid">
        {AVATARS.map((avatar) => (
          <button
            type="button"
            key={avatar.id}
            className="char-card avatar-choice-card"
            onClick={() => !loading && selectCharacter(avatar.id)}
            disabled={loading}
          >
            <img src={avatar.preview} alt={avatar.name} className="char-preview" />
            <p className="pixel-title" style={{ fontSize: '1rem', marginTop: '1rem' }}>
              {avatar.name.toUpperCase()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
