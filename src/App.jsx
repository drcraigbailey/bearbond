import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { App as CapacitorApp } from '@capacitor/app'; 
import AuthScreen from './components/AuthScreen';
import CharacterSelectScreen from './components/CharacterSelectScreen';
import PairingScreen from './components/PairingScreen';
import MainBearScene from './components/MainBearScene';
import { registerPushNotifications } from './lib/pushNotifications';
import './styles/BearBond.css';
import './styles/BearBondLayoutFix.css';

const getStoredPairKey = (userId) => `bearbond.pair.${userId}`;

const getStoredPairId = (userId) => {
  if (typeof window === 'undefined' || !userId) return null;
  return window.localStorage.getItem(getStoredPairKey(userId));
};

const saveStoredPairId = (userId, pairId) => {
  if (typeof window === 'undefined' || !userId || !pairId) return;
  window.localStorage.setItem(getStoredPairKey(userId), pairId);
};

const clearStoredPairId = (userId) => {
  if (typeof window === 'undefined' || !userId) return;
  window.localStorage.removeItem(getStoredPairKey(userId));
};

const chooseBestPair = (pairs, userId, storedPairId) => {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;

  const usablePairs = pairs.filter((item) =>
    item && (item.user_one_id === userId || item.user_two_id === userId)
  );

  if (usablePairs.length === 0) return null;

  const storedPair = usablePairs.find((item) => item.id === storedPairId);
  if (storedPair) return storedPair;

  const connectedPair = usablePairs.find((item) => item.user_one_id && item.user_two_id);
  if (connectedPair) return connectedPair;

  return usablePairs[0];
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pair, setPair] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfileAndPair(session.user.id, session.user.email);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfileAndPair(session.user.id, session.user.email);
      } else {
        setProfile(null);
        setPair(null);
        setLoading(false);
      }
    });

    const setupBackButton = async () => {
      try {
        await CapacitorApp.addListener('backButton', () => { CapacitorApp.minimizeApp(); });
      } catch (e) { /* Browser fallback */ }
    };
    setupBackButton();

    return () => {
      subscription.unsubscribe();
      CapacitorApp.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id && profile?.id) {
      registerPushNotifications(session.user.id);
    }
  }, [session?.user?.id, profile?.id]);

  const fetchProfileAndPair = async (userId, email) => {
    setLoading(true);

    // 1. Get user profile (or create one)
    let { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!prof) {
      const newProf = { id: userId, email: email };
      await supabase.from('profiles').insert([newProf]);
      prof = newProf;
    }
    setProfile(prof);

    // 2. Get all visible pair rows and keep the best existing connection.
    // This avoids being thrown back to pairing if older pair rows exist.
    const storedPairId = getStoredPairId(userId);
    const { data: pairRows, error: pairError } = await supabase
      .from('pairs')
      .select('*')
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`);

    if (pairError) {
      console.warn('Could not fetch pairs:', pairError.message);
    }

    const selectedPair = chooseBestPair(pairRows || [], userId, storedPairId);

    if (selectedPair?.id) {
      saveStoredPairId(userId, selectedPair.id);
    }

    setPair(selectedPair);
    setLoading(false);
  };

  const handlePaired = (newPair) => {
    if (session?.user?.id && newPair?.id) {
      saveStoredPairId(session.user.id, newPair.id);
    }

    setPair(newPair);
  };

  const handlePairReset = async () => {
    if (session?.user?.id) {
      clearStoredPairId(session.user.id);
    }

    setPair(null);
  };

  const handleCharacterChange = async () => {
    if (!session?.user?.id) return;

    await supabase
      .from('profiles')
      .update({ character: null })
      .eq('id', session.user.id);

    setProfile((currentProfile) => currentProfile
      ? { ...currentProfile, character: null }
      : currentProfile
    );
  };

  const handleLogout = async () => {
    setLoading(false);
    setSession(null);
    setProfile(null);
    setPair(null);
    await supabase.auth.signOut();
  };

  if (loading) return <div className="loading-screen">Loading BearBond...</div>;

  if (!session) return <AuthScreen />;
  
  // Intercept here if they haven't picked a character yet, or want to change it.
  if (!profile?.character) return (
    <CharacterSelectScreen 
      user={session.user} 
      onComplete={(char) => setProfile((currentProfile) => ({
        ...(currentProfile || { id: session.user.id, email: session.user.email }),
        character: char,
      }))} 
    />
  );
  
  if (!pair) return <PairingScreen user={session.user} onPaired={handlePaired} />;

  return (
    <MainBearScene
      user={session.user}
      pair={pair}
      profile={profile}
      onPairReset={handlePairReset}
      onCharacterChange={handleCharacterChange}
      onLogout={handleLogout}
    />
  );
}
