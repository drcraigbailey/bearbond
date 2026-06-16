import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import yogiImg from '../assets/bear/main.png';
import craigImg from '../assets/bear/main1.png'; // <--- Changed to .png

export default function CharacterSelectScreen({ user, onComplete }) {
  const [loading, setLoading] = useState(false);

  const selectCharacter = async (charName) => {
    setLoading(true);
    // Update the profile in the database
    await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email, character: charName });
    
    // Move to the next screen
    onComplete(charName);
  };

  return (
    <div className="auth-screen screen-padding">
      <h2 className="pixel-title">Who are you?</h2>
      <p className="subtitle">Your partner will see the other character.</p>
      
      <div className="character-select-grid">
        <div className="char-card" onClick={() => !loading && selectCharacter('yogi')}>
          <img src={yogiImg} alt="Yogi" className="char-preview" />
          <p className="pixel-title" style={{ fontSize: '1rem', marginTop: '1rem' }}>YOGI</p>
        </div>

        <div className="char-card" onClick={() => !loading && selectCharacter('craig')}>
          <img src={craigImg} alt="Craig" className="char-preview" />
          <p className="pixel-title" style={{ fontSize: '1rem', marginTop: '1rem' }}>CRAIG</p>
        </div>
      </div>
    </div>
  );
}