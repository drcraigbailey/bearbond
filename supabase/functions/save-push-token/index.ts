import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing Supabase environment variables.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();

    if (!jwt) {
      return jsonResponse({ error: 'Missing Authorization bearer token.' }, 401);
    }

    const { token, platform } = await req.json();

    if (!token) {
      return jsonResponse({ error: 'Missing push token.' }, 400);
    }

    const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(jwt);

    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: userError?.message || 'Could not verify user.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        push_token: token,
        push_platform: platform || 'android',
        push_updated_at: new Date().toISOString(),
      })
      .eq('id', userData.user.id)
      .select('id, push_updated_at')
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    if (!data?.id) {
      return jsonResponse({ error: 'Profile row not found for this user.' }, 404);
    }

    return jsonResponse({ saved: true, userId: data.id, pushUpdatedAt: data.push_updated_at });
  } catch (error) {
    return jsonResponse({ error: error.message || 'Unknown save push token error.' }, 500);
  }
});
