import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

// Get current session user ID
const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
};

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  availableLanguages: { code: string; name: string; flag: string }[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  // Don't throw error, return undefined if not available
  // The components will handle this gracefully
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [isLoaded, setIsLoaded] = useState(false);

  // Memoize availableLanguages to prevent recreation on every render
  const availableLanguages = useMemo(() => [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  ], []);

  // Load language preference from Supabase on mount
  useEffect(() => {
    const loadLanguagePreference = async () => {
      // Get current user ID from session
      const currentUserId = await getCurrentUserId();
      
      if (!currentUserId) {
        // No user ID, just use localStorage
        const storedLang = localStorage.getItem('i18nextLng') || 'en';
        i18n.changeLanguage(storedLang);
        setCurrentLanguage(storedLang);
        setIsLoaded(true);
        return;
      }

      try {
        // First try to load from Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('language_preference')
          .eq('user_id', currentUserId)
          .single();

        if (!error && data?.language_preference) {
          const prefLang = data.language_preference as string;
          i18n.changeLanguage(prefLang);
          setCurrentLanguage(prefLang);
          localStorage.setItem('i18nextLng', prefLang);
        } else {
          // Fallback to localStorage
          const storedLang = localStorage.getItem('i18nextLng') || 'en';
          i18n.changeLanguage(storedLang);
          setCurrentLanguage(storedLang);
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
        // Fallback to localStorage
        const storedLang = localStorage.getItem('i18nextLng') || 'en';
        i18n.changeLanguage(storedLang);
        setCurrentLanguage(storedLang);
      } finally {
        setIsLoaded(true);
      }
    };

    loadLanguagePreference();
  }, [i18n]);

  // Memoize setLanguage function to prevent recreation on every render
  const setLanguage = useCallback(async (language: string) => {
    i18n.changeLanguage(language);
    setCurrentLanguage(language);
    localStorage.setItem('i18nextLng', language);

    // Also save to Supabase if user is logged in
    try {
      const currentUserId = await getCurrentUserId();
      if (currentUserId) {
        await supabase
          .from('profiles')
          .update({ language_preference: language })
          .eq('user_id', currentUserId);
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
      // Don't throw - localStorage is already saved
    }
  }, [i18n]);

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    currentLanguage,
    setLanguage,
    availableLanguages,
  }), [currentLanguage, setLanguage, availableLanguages]);

  // Show children only after language is loaded to prevent flashing
  if (!isLoaded) {
    return <>{children}</>;
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};
