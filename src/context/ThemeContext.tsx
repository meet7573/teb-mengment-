import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  backgroundColor: string;
  cardColor: string;
  buttonColor: string;
  borderColor: string;
  fontColor: string;
}

export const defaultTheme: ThemeConfig = {
  primaryColor: '#4F46E5', // Indigo
  secondaryColor: '#0EA5E9', // Sky
  accentColor: '#8B5CF6', // Purple
  successColor: '#10B981', // Emerald
  warningColor: '#F59E0B', // Amber
  errorColor: '#EF4444', // Rose
  backgroundColor: '#F8FAFC', // Slate 50
  cardColor: '#FFFFFF', // White
  buttonColor: '#4F46E5', // Indigo
  borderColor: '#E2E8F0', // Slate 200
  fontColor: '#0F172A', // Slate 900
};

export const presetThemes: { name: string; theme: ThemeConfig }[] = [
  {
    name: 'Modern Indigo (Default)',
    theme: defaultTheme,
  },
  {
    name: 'Ocean Sky',
    theme: {
      primaryColor: '#0284C7',
      secondaryColor: '#06B6D4',
      accentColor: '#2563EB',
      successColor: '#10B981',
      warningColor: '#F59E0B',
      errorColor: '#EF4444',
      backgroundColor: '#F0F9FF',
      cardColor: '#FFFFFF',
      buttonColor: '#0284C7',
      borderColor: '#BAE6FD',
      fontColor: '#0C4A6E',
    },
  },
  {
    name: 'Emerald Campus',
    theme: {
      primaryColor: '#059669',
      secondaryColor: '#10B981',
      accentColor: '#0D9488',
      successColor: '#10B981',
      warningColor: '#D97706',
      errorColor: '#DC2626',
      backgroundColor: '#F0FDF4',
      cardColor: '#FFFFFF',
      buttonColor: '#059669',
      borderColor: '#BBF7D0',
      fontColor: '#064E3B',
    },
  },
  {
    name: 'Royal Purple',
    theme: {
      primaryColor: '#7C3AED',
      secondaryColor: '#A855F7',
      accentColor: '#EC4899',
      successColor: '#10B981',
      warningColor: '#F59E0B',
      errorColor: '#EF4444',
      backgroundColor: '#FAF5FF',
      cardColor: '#FFFFFF',
      buttonColor: '#7C3AED',
      borderColor: '#E9D5FF',
      fontColor: '#3B0764',
    },
  },
  {
    name: 'Slate Enterprise',
    theme: {
      primaryColor: '#2563EB',
      secondaryColor: '#64748B',
      accentColor: '#475569',
      successColor: '#16A34A',
      warningColor: '#D97706',
      errorColor: '#DC2626',
      backgroundColor: '#F1F5F9',
      cardColor: '#FFFFFF',
      buttonColor: '#2563EB',
      borderColor: '#CBD5E1',
      fontColor: '#1E293B',
    },
  },
];

interface ThemeContextType {
  theme: ThemeConfig;
  updateTheme: (newTheme: Partial<ThemeConfig>) => void;
  applyPreset: (presetTheme: ThemeConfig) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'stm_custom_theme_v1';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return { ...defaultTheme, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback to default
    }
    return defaultTheme;
  });

  // Apply CSS custom variables whenever theme updates
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.style.setProperty('--success-color', theme.successColor);
    root.style.setProperty('--warning-color', theme.warningColor);
    root.style.setProperty('--error-color', theme.errorColor);
    root.style.setProperty('--bg-color', theme.backgroundColor);
    root.style.setProperty('--card-color', theme.cardColor);
    root.style.setProperty('--button-color', theme.buttonColor);
    root.style.setProperty('--border-color', theme.borderColor);
    root.style.setProperty('--font-color', theme.fontColor);

    // Also persist
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const updateTheme = (newTheme: Partial<ThemeConfig>) => {
    setTheme((prev) => ({ ...prev, ...newTheme }));
  };

  const applyPreset = (presetTheme: ThemeConfig) => {
    setTheme(presetTheme);
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, applyPreset, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
