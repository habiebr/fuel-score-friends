import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      'https://eecdbddpzwedficnpenm.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlY2RiZGRwendlZGZpY25wZW5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5NjE4NzYxNCwiZXhwIjoyMDExNzYzNjE0fQ.l_YcDwjh0e1HyUNhw4kcQCuBHZKqmNpWGW6AZ8khSEs'
    );

    // Parse request
    const { userId } = await req.json();
    if (!userId) {
      throw new Error('userId is required');
    }

    console.log('Debug: Querying google_tokens for user:', userId);

    // Query ALL tokens first
    const { data: allTokens, error: tokensError } = await supabase
      .from('google_tokens')
      .select('*');

    console.log('Debug: All tokens in database:', JSON.stringify(allTokens, null, 2));
    
    // Query user's token specifically
    const { data: userToken, error: userError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('Debug: User specific token:', JSON.stringify(userToken, null, 2));

    return new Response(
      JSON.stringify({
        message: 'Database debug response',
        allTokens,
        tokensError,
        userToken,
        userError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});