import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import PixelAlert from './PixelAlert';

export default function PairingScreen({ user, onPaired }) {
  const [pairingCode, setPairingCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Generate a random code for the current user when the screen loads
  useEffect(() => {
    const initProfileAndPair = async () => {
      await supabase.from('profiles').upsert({ id: user.id, email: user.email });
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setPairingCode(newCode);
    };
    initProfileAndPair();
  }, [user]);

  // User A: Creates the room with their generated code
  const handleCreatePair = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('pairs')
      .insert([{ user_one_id: user.id, pairing_code: pairingCode }])
      .select()
      .single();
      
    if (error) {
      setAlertMessage(`Could not create room: ${error.message}`);
    } else if (data) {
      onPaired(data);
    }
    
    setLoading(false);
  };

  // User B: Tries to join User A's room using the code
  const handleJoinPair = async () => {
    if (!joinCode.trim()) {
      setAlertMessage('Please enter a code first!');
      return;
    }

    setLoading(true);
    const formattedCode = joinCode.trim().toUpperCase();

    const { data: existingPair, error: fetchError } = await supabase
      .from('pairs')
      .select('*')
      .eq('pairing_code', formattedCode)
      .maybeSingle();

    if (fetchError) {
      setAlertMessage(`Database Error: ${fetchError.message}`);
      setLoading(false);
      return;
    }

    if (!existingPair) {
      setAlertMessage('Code not found. Did your partner click "Start Waiting for Partner" first?');
      setLoading(false);
      return;
    }

    if (existingPair.user_two_id) {
      setAlertMessage('This room already has two bears connected!');
      setLoading(false);
      return;
    }

    const { data: updatedPair, error: updateError } = await supabase
      .from('pairs')
      .update({ user_two_id: user.id })
      .eq('id', existingPair.id)
      .select()
      .single();
    
    if (updateError) {
      setAlertMessage(`Could not join room: ${updateError.message}`);
    } else if (updatedPair) {
      onPaired(updatedPair);
    }
    
    setLoading(false);
  };

  return (
    <div className="pairing-screen screen-padding">
      <h2 className="pixel-title">Connect</h2>
      
      <div className="card">
        <h3>Create a connection</h3>
        <p>Your pairing code is:</p>
        <div className="code-display">{pairingCode}</div>
        <button 
          onClick={handleCreatePair} 
          disabled={loading} 
          className="pixel-btn primary"
        >
          {loading ? 'Starting...' : 'Start Waiting for Partner'}
        </button>
      </div>

      <div className="divider">OR</div>

      <div className="card">
        <h3>Join a partner</h3>
        <input 
          type="text" 
          placeholder="ENTER CODE" 
          value={joinCode} 
          onChange={(e) => setJoinCode(e.target.value)}
          className="pixel-input text-center"
          maxLength={6}
        />
        <button 
          onClick={handleJoinPair} 
          disabled={loading || !joinCode} 
          className="pixel-btn secondary"
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>

      <PixelAlert message={alertMessage} onClose={() => setAlertMessage('')} />
    </div>
  );
}