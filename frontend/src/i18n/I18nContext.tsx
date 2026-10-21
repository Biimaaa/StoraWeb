import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { id } from './locales/id';
import { en } from './locales/en';

type Language = 'id' | 'en';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translations: Record<Language, any> = {
  id,
  en,
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('storaweb_lang');
    return saved === 'en' ? 'en' : 'id';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('storaweb_lang', lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');
      let current: any = translations[language];

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to id
          let fallback: any = translations.id;
          for (const fbK of keys) {
            if (fallback && typeof fallback === 'object' && fbK in fallback) {
              fallback = fallback[fbK];
            } else {
              return key;
            }
          }
          current = fallback;
          break;
        }
      }

      if (typeof current !== 'string') {
        return key;
      }

      let res = current;
      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          res = res.replace(new RegExp(`{${pKey}}`, 'g'), String(pVal));
        });
      }
      return res;
    };
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
