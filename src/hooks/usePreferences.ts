import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function usePreferences() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const getPreference = useCallback(async (key: string): Promise<any> => {
    if (!user) return null;

    try {
      // Try localStorage first for faster access
      const cached = localStorage.getItem(`pref_${user.id}_${key}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('user_preferences')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;
      
      // Cache in localStorage
      if (data?.value) {
        localStorage.setItem(`pref_${user.id}_${key}`, JSON.stringify(data.value));
      }

      return data?.value || null;
    } catch (error) {
      console.error(`Error getting preference ${key}:`, error);
      return null;
    }
  }, [user]);

  const setPreference = useCallback(async (key: string, value: any): Promise<void> => {
    if (!user) return;

    try {
      // Update Supabase
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          key,
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key'
        });

      if (error) throw error;

      // Update localStorage
      localStorage.setItem(`pref_${user.id}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting preference ${key}:`, error);
      throw error;
    }
  }, [user]);

  // Load initial preferences
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('key, value')
          .eq('user_id', user.id);

        if (error) throw error;

        // Cache all preferences in localStorage
        (data || []).forEach(({ key, value }) => {
          localStorage.setItem(`pref_${user.id}_${key}`, JSON.stringify(value));
        });
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  return {
    getPreference,
    setPreference,
    loading
  };
}
