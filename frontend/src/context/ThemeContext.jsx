import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const getInitialTheme = () => {
    try {
        const savedTheme = window.localStorage.getItem('app_theme');
        return ['system', 'light', 'dark'].includes(savedTheme) ? savedTheme : 'dark';
    } catch {
        return 'dark';
    }
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
        const applyTheme = () => {
            const useDarkTheme = theme === 'dark' || (theme === 'system' && systemTheme.matches);
            document.documentElement.classList.toggle('dark', useDarkTheme);
            window.localStorage.setItem('app_theme', theme);
        };

        applyTheme();
        if (theme !== 'system') return undefined;

        systemTheme.addEventListener('change', applyTheme);
        return () => systemTheme.removeEventListener('change', applyTheme);
    }, [theme]);

    const toggleTheme = () => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// هوک کاستوم برای استفاده راحت در داشبورد
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        // این هشدار جلوی کرش کردن را می‌گیرد و مقدار پیش‌فرض می‌دهد
        console.warn("useTheme must be used within a ThemeProvider");
        return { theme: 'dark', setTheme: () => {}, toggleTheme: () => {} };
    }
    return context;
};