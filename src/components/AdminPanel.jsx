import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const getAdminEmails = () => {
  return (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

const shortId = (id) => id ? `${id.slice(0, 8)}...` : 'None';

export default function AdminPanel({ user, profile, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const adminEmails = useMemo(getAdminEmails, []);
  const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());

  const profileById = useMemo(() => {
    return profiles.reduce((map, item) => {
      map[item.id] = item;
      return map;
    }, {});
  }, [profiles]);

  const getProfileLabel = (id) => {
    if (!id) return 'Waiting for partner';
    const matchedProfile = profileById[id];
    return matchedProfile?.email || shortId(id);
  };

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage('');

    const [{ data: profileData, error: profileError }, { data: pairData, error: pairError }] = await Promise.all([
      supabase.from('profiles').select('*').order('email', { ascending: true }),
      supabase.from('pairs').select('*').order('id', { ascending: false }),
    ]);

    if (profileError || pairError) {
      setMessage(profileError?.message || pairError?.message || 'Could not load admin data.');
    } else {
      setProfiles(profileData || []);
      setPairs(pairData || []);
    }

    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const deleteProfile = async (profileToDelete) => {
    if (profileToDelete.id === user.id) {
      setMessage('You cannot delete the active admin profile from here.');
      return;
    }

    const confirmed = window.confirm(`Delete profile for ${profileToDelete.email || shortId(profileToDelete.id)}? This removes their profile row and any pair rooms they are in.`);
    if (!confirmed) return;

    setLoading(true);
    setMessage('');

    const { data: pairsToDelete, error: pairFetchError } = await supabase
      .from('pairs')
      .select('id')
      .or(`user_one_id.eq.${profileToDelete.id},user_two_id.eq.${profileToDelete.id}`);

    if (pairFetchError) {
      setMessage(pairFetchError.message);
      setLoading(false);
      return;
    }

    const pairIds = (pairsToDelete || []).map((pair) => pair.id);

    if (pairIds.length) {
      await supabase.from('pair_events').delete().in('pair_id', pairIds);
      const { error: pairDeleteError } = await supabase.from('pairs').delete().in('id', pairIds);

      if (pairDeleteError) {
        setMessage(pairDeleteError.message);
        setLoading(false);
        return;
      }
    }

    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileToDelete.id);

    if (profileDeleteError) {
      setMessage(profileDeleteError.message);
    } else {
      setMessage('Profile deleted.');
      await loadAdminData();
      return;
    }

    setLoading(false);
  };

  const unpair = async (pair) => {
    const confirmed = window.confirm('Unpair this room and put it back into waiting mode?');
    if (!confirmed) return;

    setLoading(true);
    setMessage('');

    await supabase.from('pair_events').delete().eq('pair_id', pair.id);

    const { error } = await supabase
      .from('pairs')
      .update({
        user_two_id: null,
        active_scene: 'home',
        last_action: null,
        last_action_from: null,
        last_action_at: null,
      })
      .eq('id', pair.id);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage('Pair unlinked.');
    await loadAdminData();
  };

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Admin panel">
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2 className="settings-title">Admin Panel</h2>
          <button onClick={onClose} className="admin-close-btn" aria-label="Close admin panel">✕</button>
        </div>

        {!isAdmin ? (
          <div className="admin-denied-card">
            <p>Admin access is locked for this account.</p>
            <p className="admin-help-text">Add your email to VITE_ADMIN_EMAILS or set your profile role to admin.</p>
          </div>
        ) : (
          <>
            {message && <div className="admin-message">{message}</div>}
            {loading && <div className="admin-message">Loading...</div>}

            <section className="admin-section">
              <h3>Profiles</h3>
              <div className="admin-list">
                {profiles.map((item) => (
                  <div key={item.id} className="admin-list-row">
                    <div className="admin-row-copy">
                      <strong>{item.email || 'No email'}</strong>
                      <span>{item.character || 'No character'} · {shortId(item.id)}</span>
                    </div>
                    <button
                      onClick={() => deleteProfile(item)}
                      disabled={loading || item.id === user.id}
                      className="admin-mini-btn danger"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-section">
              <h3>Pairs</h3>
              <div className="admin-list">
                {pairs.map((pair) => (
                  <div key={pair.id} className="admin-list-row pair-row">
                    <div className="admin-row-copy">
                      <strong>{getProfileLabel(pair.user_one_id)}</strong>
                      <span>with {getProfileLabel(pair.user_two_id)}</span>
                      <span>code {pair.pairing_code || 'None'} · scene {pair.active_scene || 'home'}</span>
                    </div>
                    <button
                      onClick={() => unpair(pair)}
                      disabled={loading || !pair.user_two_id}
                      className="admin-mini-btn"
                    >
                      Unpair
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
