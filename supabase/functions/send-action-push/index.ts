import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FIREBASE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

const toBase64Url = (input: string | Uint8Array) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const privateKeyToArrayBuffer = (privateKey: string) => {
  const cleanedKey = privateKey
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binary = atob(cleanedKey);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
};

const getFirebaseAccessToken = async () => {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Firebase service account secrets.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: FIREBASE_SCOPE,
    aud: FIREBASE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claim))}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedJwt),
  );

  const signedJwt = `${unsignedJwt}.${toBase64Url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch(FIREBASE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    throw new Error(`Firebase auth failed: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token as string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      pairId,
      senderId,
      actionName,
      eventType = 'action',
      notificationLabel,
      eventAt,
    } = await req.json();

    if (!pairId || !senderId || !actionName) {
      return jsonResponse({ error: 'Missing pairId, senderId, or actionName.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID');

    if (!supabaseUrl || !serviceRoleKey || !firebaseProjectId) {
      return jsonResponse({ error: 'Missing Supabase or Firebase environment variables.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: pair, error: pairError } = await supabase
      .from('pairs')
      .select('user_one_id, user_two_id')
      .eq('id', pairId)
      .single();

    if (pairError || !pair) {
      return jsonResponse({ error: pairError?.message || 'Pair not found.' }, 404);
    }

    const receiverId = pair.user_one_id === senderId ? pair.user_two_id : pair.user_one_id;

    if (!receiverId || receiverId === senderId) {
      return jsonResponse({ skipped: true, reason: 'No paired receiver.' });
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, character, display_name, push_token')
      .in('id', [senderId, receiverId]);

    if (profileError || !profiles) {
      return jsonResponse({ error: profileError?.message || 'Profiles not found.' }, 404);
    }

    const senderProfile = profiles.find((item) => item.id === senderId);
    const receiverProfile = profiles.find((item) => item.id === receiverId);

    if (!receiverProfile?.push_token) {
      return jsonResponse({ skipped: true, reason: 'Receiver has no push token saved.' });
    }

    const savedSenderName = String(senderProfile?.display_name || '').trim();
    const senderName = savedSenderName || (senderProfile?.character
      ? senderProfile.character.charAt(0).toUpperCase() + senderProfile.character.slice(1)
      : 'Your partner');

    const cleanEventType = eventType === 'scene'
      ? 'scene'
      : eventType === 'chat'
        ? 'chat'
        : 'action';
    const cleanLabel = String(notificationLabel || actionName);
    const cleanEventAt = String(eventAt || new Date().toISOString());
    const notificationBody = cleanEventType === 'scene'
      ? `${senderName} changed your scene to ${cleanLabel}! 🏞️`
      : cleanEventType === 'chat'
        ? `${senderName} sent you a message! 💬`
        : `${senderName} sent you a ${cleanLabel}! ❤️`;

    const accessToken = await getFirebaseAccessToken();

    const firebaseResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: receiverProfile.push_token,
            notification: {
              title: 'BearBond',
              body: notificationBody,
            },
            data: {
              pairId: String(pairId),
              senderId: String(senderId),
              actionName: String(actionName),
              eventType: cleanEventType,
              notificationLabel: cleanLabel,
              eventAt: cleanEventAt,
            },
            android: {
              priority: 'HIGH',
              notification: {
                channel_id: 'bearbond-actions',
                sound: 'default',
                default_vibrate_timings: true,
              },
            },
          },
        }),
      },
    );

    const firebaseData = await firebaseResponse.json();

    if (!firebaseResponse.ok) {
      return jsonResponse({ error: 'Firebase send failed.', details: firebaseData }, 500);
    }

    return jsonResponse({ sent: true, firebase: firebaseData });
  } catch (error) {
    return jsonResponse({ error: error.message || 'Unknown push error.' }, 500);
  }
});
