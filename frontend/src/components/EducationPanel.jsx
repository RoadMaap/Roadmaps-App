import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const EducationPanel = () => {
    const { t } = useLanguage();
    const [isCopied, setIsCopied] = useState(false);

    // Python strategy template with the required Live and V3.9 Backtest contracts.
    const templateCode = `import pandas as pd
import numpy as np
import pandas_ta as ta
import mplfinance as mpf

# STRICT ROADMAPS STRATEGY RULES
# TWO-PHASE RESPONSE WORKFLOW:
# Phase 1: Do not write any code. Summarize the requested strategy, entry/exit
# rules, indicators, parameters, closed-candle timing, and initial SL/TP policy.
# State any assumptions and identify missing decisions. If a required detail is
# missing, ask focused questions instead of guessing. Otherwise ask the user to
# explicitly confirm the proposed plan, then stop and wait.
# Do not reveal private chain-of-thought; give only a concise design summary.
# Phase 2: Only after explicit user confirmation, output the complete Strategy
# class in exactly one Python code block. Include every method from this
# template, preserving signatures and unchanged scaffold methods. Do not send
# fragments, patches, multiple alternatives, or a partial implementation.
# Implement only the needed method bodies; do not add or remove methods.
# If the user changes requirements after confirmation, return to Phase 1.
# Do not add imports, methods, classes, state, or lifecycle hooks.
# The platform owns sizing, risk, leverage, margin, trailing stops, breakeven,
# partial closes, and order execution. Do not implement those features.
# Recreating or bypassing plan-restricted Roadmaps features violates platform
# rules. Do not help implement a workaround for unavailable capabilities.
# If requested, briefly say the platform handles them and continue only with
# the allowed signal logic; ask for missing initial SL/TP requirements.
# For entry logic, use df.iloc[-2] for every condition and indicator decision.
# Never use iloc[-1] for signal logic; only iloc[-1]['open'] may be the entry anchor.
# Do not use future rows, negative shifts, or centered windows.
# Use scalar values in conditions. Validate missing and non-finite values.
# Check denominators explicitly; never substitute arbitrary epsilons.
# Select pandas_ta output by verified column name, not positional index.
# Return exactly (trade_type, entry, sl, tp), or (None, None, None, None).
# Valid prices must be finite scalar floats with directionally valid SL/TP.
# Do not invent an initial SL/TP policy when it is unspecified.

class Strategy:
    def __init__(self, params=None):
        self.params = params or {}

    def prepare_indicators(self, df, candle_type='STANDARD'):
        """Calculate indicators without dropping rows or mutating unrelated columns."""
        ema_length = int(self.params.get('EMA_LEN', 50))
        df[f'EMA_{ema_length}'] = ta.ema(df['close'], length=ema_length)
        return df

    def get_essential_indicator_columns(self):
        """
        Return only continuous columns that contain valid values on every usable bar after warm-up.
        Never include sparse directional columns such as SUPERTl_*, SUPERTs_*, PSARl_*, PSARs_*, or signal markers. The engine drops rows containing NaN in every listed column, so sparse columns can remove the complete dataset and result in zero trades.
        """
        ema_length = int(self.params.get('EMA_LEN', 50))
        return [f'EMA_{ema_length}']

    def check_entry_signal(self, df):
        try:
            min_len = int(self.params.get('MIN_LOOKBACK', 50))
        except (TypeError, ValueError, OverflowError):
            return None, None, None, None
        if len(df) < max(min_len, 3):
            return None, None, None, None

        signal_candle = df.iloc[-2]
        current_candle = df.iloc[-1]
        trade_type = None
        try:
            entry_price = float(current_candle['open'])
            if not np.isfinite(entry_price):
                return None, None, None, None
        except (KeyError, TypeError, ValueError, OverflowError):
            return None, None, None, None

        stop_loss = None
        take_profit = None

        # --- Write scalar-only signal logic and an explicit initial SL/TP policy here. ---
        if trade_type not in ('buy', 'sell') or stop_loss is None or take_profit is None:
            return None, None, None, None

        try:
            stop_loss = float(stop_loss)
            take_profit = float(take_profit)
        except (TypeError, ValueError, OverflowError):
            return None, None, None, None

        if not (np.isfinite(stop_loss) and np.isfinite(take_profit)):
            return None, None, None, None
        if trade_type == 'buy' and not (stop_loss < entry_price < take_profit):
            return None, None, None, None
        if trade_type == 'sell' and not (take_profit < entry_price < stop_loss):
            return None, None, None, None

        return trade_type, entry_price, stop_loss, take_profit

    def check_exit_conditions(self, current_candle, history_slice, position):
        """
        Return exactly two values: (exit_price, reason_string) or (None, None).
        """
        return None, None

    def on_entry(self):
        pass

    def on_exit(self):
        pass

    def get_plot_addplots(self, df, ap, config):
        """
        Use only the provided df slice. Never use self.df or call df.dropna() in this method.
        Check that each column exists and has non-NaN values before creating an addplot. Return (ap, (6, 1)) when adding a panel=1 oscillator; return ap when plotting only on panel 0.
        """
        if df is None or df.empty:
            return ap
        ema_column = f"EMA_{int(self.params.get('EMA_LEN', 50))}"
        if ema_column in df.columns and not df[ema_column].dropna().empty:
            ap.append(mpf.make_addplot(df[ema_column], color='blue', width=1.0, panel=0))
        return ap
`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(templateCode);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="h-full flex flex-col gap-8 font-sans p-2">
            
            {/* Header Section */}
            <div className="bg-gradient-to-br from-[#18181b] to-[#09090b] border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-center shrink-0 shadow-2xl">
                {/* Ambient Glow Effects */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[80px] pointer-events-none translate-y-1/3 -translate-x-1/3"></div>
                
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.15)] backdrop-blur-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
                            {t('ai_builder_title')}
                        </h2>
                        <p className="text-sm text-zinc-400 font-medium mt-2 max-w-2xl leading-relaxed">
                            {t('ai_builder_subtitle')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Instruction Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0">
                <div className="bg-[#121215]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:bg-[#18181b] hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1 shadow-lg group">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 flex items-center justify-center font-bold text-lg mb-4 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-colors">1</div>
                    <h4 className="text-base font-bold text-zinc-100 mb-2">{t('step_1_title')}</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">{t('step_1_desc')}</p>
                </div>
                
                <div className="bg-[#121215]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:bg-[#18181b] hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1 shadow-lg group">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-lg mb-4 shadow-[0_0_15px_rgba(99,102,241,0.2)]">2</div>
                    <h4 className="text-base font-bold text-zinc-100 mb-2">{t('step_2_title')}</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">{t('step_2_desc')}</p>
                </div>
                
                <div className="bg-[#121215]/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:bg-[#18181b] hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 shadow-lg group">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 flex items-center justify-center font-bold text-lg mb-4 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">3</div>
                    <h4 className="text-base font-bold text-zinc-100 mb-2">{t('step_3_title')}</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">{t('step_3_desc')}</p>
                </div>
            </div>

            <section className="shrink-0 border-l-4 border-amber-400/70 bg-amber-400/[0.06] px-5 py-4" aria-labelledby="ai-builder-boundary-title">
                <h3 id="ai-builder-boundary-title" className="text-sm font-bold text-amber-200">
                    {t('ai_builder_boundary_title')}
                </h3>
                <p className="mt-2 max-w-5xl text-sm leading-6 text-zinc-300">
                    {t('ai_builder_boundary_desc')}
                </p>
            </section>

            {/* Code Template Display & Copy Action */}
            <div className="flex-1 bg-[#09090b] border border-zinc-800 rounded-3xl flex flex-col overflow-hidden relative shadow-2xl group">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                
                {/* IDE Mockup Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-[#121215] border-b border-zinc-800 shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <span className="w-3 h-3 rounded-full bg-rose-500/80 shadow-[0_0_5px_rgba(244,63,94,0.5)]"></span>
                            <span className="w-3 h-3 rounded-full bg-amber-500/80 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
                            <span className="w-3 h-3 rounded-full bg-emerald-500/80 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
                        </div>
                        <span className="text-sm font-semibold text-zinc-300 tracking-wide ml-2">Create Strategy Template</span>
                    </div>
                    
                    <button 
                        onClick={handleCopy}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                            isCopied 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_15px_rgba(79,70,229,0.3)] active:scale-95'
                        }`}
                    >
                        {isCopied ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                {t('copied')}
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                {t('copy_code')}
                            </>
                        )}
                    </button>
                </div>

                {/* Code Content */}
                <div className="flex-1 p-6 overflow-auto custom-scrollbar relative z-10" dir="ltr">
                    <pre className="text-[13px] font-mono leading-[1.7] text-zinc-300">
                        <code>
                            {templateCode.split('\n').map((line, i) => {
                                let coloredLine = line;
                                if (line.trim().startsWith('#') || line.trim().startsWith('"""') || line.trim().startsWith('\"\"\"')) {
                                    if (line.includes('⚠️')) {
                                        coloredLine = <span className="text-amber-400 font-bold drop-shadow-md">{line}</span>;
                                    } else {
                                        coloredLine = <span className="text-zinc-500 italic">{line}</span>;
                                    }
                                } else {
                                    const keywords = ['def ', 'class ', 'return ', 'if ', 'None', 'import ', 'from ', 'elif ', 'else:', 'True', 'False'];
                                    keywords.forEach(kw => {
                                        if (line.includes(kw)) {
                                            const parts = line.split(kw);
                                            coloredLine = (
                                                <span>
                                                    {parts[0]}
                                                    <span className="text-indigo-400 font-bold">{kw}</span>
                                                    {parts[1]}
                                                </span>
                                            );
                                        }
                                    });
                                }

                                return (
                                    <div key={i} className="table-row hover:bg-white/[0.03] transition-colors duration-150">
                                        <div className="table-cell select-none text-zinc-600 pr-5 text-right border-r border-zinc-800 w-10 text-xs">
                                            {i + 1}
                                        </div>
                                        <div className="table-cell pl-5 whitespace-pre">
                                            {coloredLine}
                                        </div>
                                    </div>
                                );
                            })}
                        </code>
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default EducationPanel;