import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { App as CapacitorApp } from '@capacitor/app'; 
import AuthScreen from './components/AuthScreen';
import CharacterSelectScreen from './components/CharacterSelectScreen';
import PairingScreen from './components/PairingScreen';
import MainBearScene from './components/MainBearScene';
import { registerPushNotifications } from './lib/pushNotifications';
import { SCENES } from './data/scenes';
import { AVATARS, AVATAR_SPRITES, mergeAvatarAssets } from './data/avatarSets';
import { loadRemoteAvatars, loadRemoteScenes } from './lib/remoteAssets';
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

const getPartnerIdFromPair = (pair, userId) => {
  if (!pair || !userId) return null;
  return pair.user_one_id === userId ? pair.user_two_id : pair.user_one_id;
};

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

const chooseBestPair = (pairs, userId, storedPairId) => {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;

  const usablePairs = pairs.filter((item) =>
    item && (item.user_one_id === userId || item.user_two_id === userId)
  );

  if (usablePairs.length === 0) return null;

  const connectedPairs = usablePairs
    .filter((item) => item.user_one_id && item.user_two_id)
    .sort((a, b) => getPairTimestamp(b) - getPairTimestamp(a));

  if (connectedPairs.length > 0) {
    return connectedPairs[0];
  }

  const storedPair = usablePairs.find((item) => item.id === storedPairId);
  if (storedPair) return storedPair;

  return usablePairs[0];
};

const pairsAreMeaningfullyDifferent = (currentPair, nextPair) => {
  if (!currentPair?.id || !nextPair?.id) return true;

  return (
    currentPair.user_one_id !== nextPair.user_one_id ||
    currentPair.user_two_id !== nextPair.user_two_id ||
    currentPair.active_scene !== nextPair.active_scene ||
    currentPair.last_action !== nextPair.last_action ||
    currentPair.last_action_from !== nextPair.last_action_from ||
    currentPair.last_action_at !== nextPair.last_action_at ||
    currentPair.last_scene !== nextPair.last_scene ||
    currentPair.last_scene_from !== nextPair.last_scene_from ||
    currentPair.last_scene_at !== nextPair.last_scene_at
  );
};

const profilesAreMeaningfullyDifferent = (currentProfile, nextProfile) => {
  if (!currentProfile?.id || !nextProfile?.id) return true;

  return (
    currentProfile.character !== nextProfile.character ||
    currentProfile.email !== nextProfile.email ||
    currentProfile.push_updated_at !== nextProfile.push_updated_at
  );
};

const mergeSceneAssets = (remoteScenes = []) => {
  const mergedScenes = { ...SCENES };

  for (const scene of remoteScenes || []) {
    if (!scene?.id || !scene?.image) continue;
    mergedScenes[scene.id] = scene;
  }

  return mergedScenes;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [pair, setPair] = useState(null);
  const [remoteScenes, setRemoteScenes] = useState([]);
  const [remoteAvatars, setRemoteAvatars] = useState([]);
  const [loading, setLoading] = useState(true);

  const scenes = useMemo(() => mergeSceneAssets(remoteScenes), [remoteScenes]);
  const avatarAssets = useMemo(() => mergeAvatarAssets(remoteAvatars), [remoteAvatars]);
  const avatars = avatarAssets.avatars || AVATARS;
  const avatarSprites = avatarAssets.avatarSprites || AVATAR_SPRITES;

  useEffect(() => {
    let cancelled = false;

    const loadCustomAssets = async () => {
      const [nextScenes, nextAvatars] = await Promise.all([
        loadRemoteScenes(),
        loadRemoteAvatars(),
      ]);

      if (cancelled) return;

      setRemoteScenes(nextScenes);
      setRemoteAvatars(nextAvatars);
    };

    loadCustomAssets();
    const pollTimer = window.setInterval(loadCustomAssets, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
    };
  }, []);

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
        setPartnerProfile(null);
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

  useEffect(() => {
    if (!session?.user?.id || !pair?.id) return undefined;

    let cancelled = false;

    const refreshCurrentPair = async () => {
      const { data, error } = await supabase
        .from('pairs')
        .select('*')
        .eq('id', pair.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('Could not refresh pair:', error.message);
        return;
      }

      if (!data || (data.user_one_id !== session.user.id && data.user_two_id !== session.user.id)) {
        clearStoredPairId(session.user.id);
        setPartnerProfile(null);
        setPair(null);
        return;
      }

      if (pairsAreMeaningfullyDifferent(pair, data)) {
        setPair(data);
      }
    };

    refreshCurrentPair();
    const pollTimer = window.setInterval(refreshCurrentPair, 2000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') refreshCurrentPair();
    };

    window.addEventListener('focus', refreshCurrentPair);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.removeEventListener('focus', refreshCurrentPair);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [session?.user?.id, pair?.id, pair?.last_action_at, pair?.last_scene_at, pair?.user_two_id]);

  useEffect(() => {
    const partnerId = getPartnerIdFromPair(pair, session?.user?.id);

    if (!partnerId) {
      setPartnerProfile(null);
      return undefined;
    }

    let cancelled = false;

    const refreshPartnerProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', partnerId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('Could not fetch partner profile:', error.message);
        return;
      }

      if (data) {
        setPartnerProfile((currentProfile) =>
          profilesAreMeaningfullyDifferent(currentProfile, data) ? data : currentProfile
        );
      }
    };

    refreshPartnerProfile();
    const pollTimer = window.setInterval(refreshPartnerProfile, 2000);

    const profileSub = supabase.channel(`partner_profile_${partnerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          setPartnerProfile(null);
          return;
        }

        if (payload.new) setPartnerProfile(payload.new);
      })
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      supabase.removeChannel(profileSub);
    };
  }, [pair?.id, pair?.user_one_id, pair?.user_two_id, session?.user?.id]);

  const fetchProfileAndPair = async (userId, email) => {
    setLoading(true);

    let { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!prof) {
      const newProf = { id: userId, email: email };
      await supabase.from('profiles').insert([newProf]);
      prof = newProf;
    }
    setProfile(prof);

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

    setPartnerProfile(null);
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

  const handleAvatarChange = async (avatarId) => {
    if (!session?.user?.id) return false;

    const { error } = await supabase
      .from('profiles')
      .update({ character: avatarId })
      .eq('id', session.user.id);

    if (error) {
      console.warn('Could not change avatar:', error.message);
      return false;
    }

    setProfile((currentProfile) => currentProfile
      ? { ...currentProfile, character: avatarId }
      : currentProfile
    );

    return true;
  };

  const handleLogout = async () => {
    setLoading(false);
    setSession(null);
    setProfile(null);
    setPartnerProfile(null);
    setPair(null);
    await supabase.auth.signOut();
  };

  const pairedDisplayProfile = useMemo(() => {
    if (!profile) return profile;

    return {
      ...profile,
      character: partnerProfile?.character || profile.character,
      partnerProfile,
      ownCharacter: profile.character,
    };
  }, [profile, partnerProfile]);

  if (loading) return <div className="loading-screen">Loading BearBond...</div>;

  if (!session) return <AuthScreen />;

  if (!profile?.character) return (
    <CharacterSelectScreen 
      user={session.user} 
      avatars={avatars}
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
      partnerProfile={partnerProfile}
      scenes={scenes}
      avatars={avatars}
      avatarSprites={avatarSprites}
      onPairReset={handlePairReset}
      onCharacterChange={handleCharacterChange}
      onAvatarChange={handleAvatarChange}
      onLogout={handleLogout}
    />
  );
}
