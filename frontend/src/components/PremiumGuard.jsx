import React from 'react';
import { useAuth } from '../context/AuthContext';

const LockIcon = ({ className = 'h-5 w-5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
        <path strokeLinecap="round" strokeWidth="2" d="M12 16v2" />
    </svg>
);

const PremiumGuard = ({ children, requiredPlan = 'Pro', className = '' }) => {
    const { hasAccess } = useAuth();
    const locked = !hasAccess(requiredPlan);

    if (!locked) return children;

    return (
        <div className={`relative isolate overflow-hidden rounded-xl ${className}`}>
            <div className="opacity-30 pointer-events-none select-none transition-opacity" aria-hidden="true" inert>
                {children}
            </div>
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#101114]/15 px-4 py-4 text-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/15 text-amber-100 shadow-[0_0_35px_rgba(251,191,36,0.13)]">
                    <LockIcon className="h-5 w-5 shrink-0" />
                </span>
            </div>
        </div>
    );
};

export default PremiumGuard;