import React, { memo, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export const LanguageSwitcher: React.FC = memo(() => {
  const languageContext = useLanguage();
  const [isChanging, setIsChanging] = useState(false);

  // Fallback if context is not available (defensive programming)
  const currentLanguage = languageContext?.currentLanguage || 'en';
  const setLanguage = languageContext?.setLanguage || ((lang: string) => console.warn('LanguageProvider not ready'));
  const availableLanguages = languageContext?.availableLanguages || [{ code: 'en', name: 'English', flag: '🇺🇸' }, { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' }];

  // Memoize currentLang to prevent find() on every render
  const currentLang = useMemo(() => 
    availableLanguages.find(lang => lang.code === currentLanguage),
    [availableLanguages, currentLanguage]
  );

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) return;
    
    setIsChanging(true);
    try {
      await setLanguage(languageCode);
    } finally {
      // Small delay to show loading state
      setTimeout(() => setIsChanging(false), 100);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          disabled={isChanging}
        >
          {isChanging ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {isChanging ? 'Changing...' : `${currentLang?.flag} ${currentLang?.name}`}
          </span>
          <span className="sm:hidden">{currentLang?.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {availableLanguages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="flex items-center gap-2"
            disabled={isChanging}
          >
            <span>{language.flag}</span>
            <span>{language.name}</span>
            {currentLanguage === language.code && (
              <span className="ml-auto text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

LanguageSwitcher.displayName = 'LanguageSwitcher';
