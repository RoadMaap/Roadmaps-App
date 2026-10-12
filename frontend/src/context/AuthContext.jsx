import React, { createContext, useContext, useMemo, useState } from 'react';

const PLAN_LEVELS = { basic: 0, pro: 1, advance: 2 };
const AuthContext = createContext(null);

const normalizePlan = (plan) => {
    const normalized = String(plan || 'Basic').trim().toLowerCase();
    return PLAN_LEVELS[normalized] === undefined
        ? 'Basic'
        : normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const AuthProvider = ({ children }) => {
    const [plan, setPlan] = useState('Basic');
    const updatePlan = (nextPlan) => setPlan(normalizePlan(nextPlan));
    const hasAccess = (requiredPlan = 'Basic') => (
        (PLAN_LEVELS[plan.toLowerCase()] ?? 0) >= (PLAN_LEVELS[normalizePlan(requiredPlan).toLowerCase()] ?? 0)
    );

    const value = useMemo(() => ({ plan, setPlan: updatePlan, hasAccess }), [plan]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};