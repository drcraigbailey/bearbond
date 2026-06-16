import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { App as CapacitorApp } from '@capacitor/app'; 
import AuthScreen from './components/AuthScreen';
import CharacterSelectScreen from './components/CharacterSelectScreen';
import PairingScreen from './components/PairingScreen';
import MainBearScene from './components/MainBearScene';
import './styles/BearBond.css';

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

  const fetchProfileAndPair = async (userId, email) => {
    // 1. Get user profile (or create one)
    let { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!prof) {
      const newProf = { id: userId, email: email };
      await supabase.from('profiles').insert([newProf]);
      prof = newProf;
    }
    setProfile(prof);

    // 2. Get existing pair
    const { data: pairData } = await supabase
      .from('pairs')
      .select('*')
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
      .maybeSingle();
    
    setPair(pairData);
    setLoading(false);
  };

  const handlePairReset = async () => {
    setPair(null);

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

  if (loading) return <div className="loading-screen">Loading BearBond...</div>;

  if (!session) return <AuthScreen />;
  
  // Intercept here if they haven't picked a character yet!
  if (!profile?.character) return (
    <CharacterSelectScreen 
      user={session.user} 
      onComplete={(char) => setProfile({ ...profile, character: char })} 
    />
  );
  
  if (!pair) return <PairingScreen user={session.user} onPaired={setPair} />;

  return (
    <MainBearScene
      user={session.user}
      pair={pair}
      profile={profile}
      onPairReset={handlePairReset}
    />
  );
}
