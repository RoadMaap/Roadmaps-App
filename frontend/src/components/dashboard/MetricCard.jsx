import React from 'react';

const themes = {
    up: { border: 'border-emerald-500/25', value: 'text-emerald-300', badge: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' },
    down: { border: 'border-[#E47770]/30', value: 'text-[#E47770]', badge: 'border-[#E47770]/20 bg-[#E47770]/5 text-[#E47770]' },
    neutral: { border: 'border-[#2F2E35]', value: 'text-[#FCFCFD]', badge: 'border-[#2F2E35] bg-[#141318] text-[#BDBABD]' },
};

const MetricCard = ({ title, value, subValue, trend = 'neutral', icon, children }) => {
    const theme = themes[trend] || themes.neutral;
    const trendGlyph = trend === 'up' ? '+' : trend === 'down' ? '−' : null;

    return (
        <section className={`flex min-h-[214px] flex-col rounded-lg border ${theme.border} bg-[#1A191E] p-4 sm:p-5`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#2F2E35] bg-[#141318] text-[#F28C45]">{icon}</span>
                    <span className="min-w-0 text-[10px] font-semibold uppercase text-[#7A797E]">{title}</span>
                </div>
                {subValue && (
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-semibold ${theme.badge}`}>
                        {trendGlyph && <span aria-hidden="true">{trendGlyph}</span>}
                        {subValue}
                    </span>
                )}
            </div>
            <p className={`mt-5 text-2xl font-bold tabular-nums ${theme.value}`}>{value}</p>
            <div className="mt-auto border-t border-[#2F2E35] pt-3">{children}</div>
        </section>
    );
};

export default MetricCard;