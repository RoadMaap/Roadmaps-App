import React, { createContext, useContext, useEffect } from 'react';

// ایجاد کانتکست برای مدیریت تم (دارک/لایت)
const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const theme = 'dark';

    useEffect(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('app_theme', 'dark');
    }, []);

    const toggleTheme = () => {};

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
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
        return { theme: 'dark', toggleTheme: () => {} };
    }
    return context;
};