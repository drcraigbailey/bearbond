import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import PixelAlert from './PixelAlert';

// Import the Yogi resting image to use as the logo
import logoImg from '../assets/bear/yogi/main.png';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const handleAuth = async (isSignUp) => {
    if (!email || !password) {
      setAlertMessage('Please enter email and password!');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAlertMessage('Signup successful! You can now log in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setAlertMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen screen-padding">
      
      {/* --- NEW LOGO SECTION --- */}
      <div className="logo-container">
        <img src={logoImg} alt="BearBond Logo" className="app-logo" />
      </div>
      
      <h1 className="pixel-title">BearBond</h1>
      <p className="subtitle">Your 8-bit companion app</p>
      
      <div className="card">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pixel-input"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="pixel-input"
        />
        <div className="button-group">
          <button onClick={() => handleAuth(false)} disabled={loading} className="pixel-btn primary">
            {loading ? '...' : 'Log In'}
          </button>
          <button onClick={() => handleAuth(true)} disabled={loading} className="pixel-btn secondary">
            Sign Up
          </button>
        </div>
      </div>

      <PixelAlert message={alertMessage} onClose={() => setAlertMessage('')} />
    </div>
  );
}
