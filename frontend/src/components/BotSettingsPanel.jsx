import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PremiumGuard from './PremiumGuard';

// کارت تنظیمات تکی برای هر استراتژی
const StrategyConfigCard = ({ name, config, onSave }) => {
    const { t } = useLanguage();
    const [localConfig, setLocalConfig] = useState(config);
    const [isExpanded, setIsExpanded] = useState(false);

    // وقتی کانفیگ اصلی عوض شد (مثلا موقع لود)، لوکال هم آپدیت شود
    React.useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveClick = () => {
        onSave(name, localConfig);
    };

    // لیست روزهای هفته
    const daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
    const dayLabels = [t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'), t('day_fri'), t('day_sat'), t('day_sun')];

    const toggleDay = (dayIndex) => {
        setLocalConfig(prev => {
            const currentDays = prev.allowed_days || [];
            if (currentDays.includes(dayIndex)) {
                return { ...prev, allowed_days: currentDays.filter(d => d !== dayIndex) };
            } else {
                return { ...prev, allowed_days: [...currentDays, dayIndex].sort() };
            }
        });
    };

    return (
        <div className="bg-[#121215] border border-white/5 rounded-xl overflow-hidden transition-all duration-200">
            {/* Header - Click to Expand */}
            <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${isExpanded ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                    <div>
                        <h4 className="text-sm font-bold text-white">{name}</h4>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            {localConfig.symbol} | {localConfig.timeframe} | Magic: {localConfig.magic_number}
                        </p>
                    </div>
                </div>
                <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Config Form Body */}
            {isExpanded && (
                <div className="p-4 border-t border-white/5 bg-[#0c0c0e]">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 uppercase font-bold">{t('symbol')}</label>
                            <input type="text" name="symbol" value={localConfig.symbol} onChange={handleChange} className="w-full h-8 bg-zinc-900 border border-white/10 rounded px-2 text-xs text-white uppercase" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 uppercase font-bold">{t('timeframe_m1').split(' -')[0]}</label>
                            <select name="timeframe" value={localConfig.timeframe} onChange={handleChange} className="w-full h-8 bg-zinc-900 border border-white/10 rounded px-2 text-xs text-zinc-300">
                                <option value="M1">M1</option><option value="M5">M5</option><option value="M15">M15</option>
                                <option value="M30">M30</option><option value="H1">H1</option><option value="H4">H4</option><option value="D1">D1</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 uppercase font-bold">{t('magic_number')}</label>
                            <input type="number" name="magic_number" value={localConfig.magic_number} onChange={handleChange} className="w-full h-8 bg-zinc-900 border border-white/10 rounded px-2 text-xs text-blue-400 font-mono" />
                        </div>
                        <PremiumGuard requiredPlan="Pro" className="block">
                            <div className="space-y-1">
                                <label className="text-[9px] text-zinc-500 uppercase font-bold">{t('custom_leverage')}</label>
                                <input type="number" min="1" name="leverage" value={localConfig.leverage ?? ''} onChange={handleChange} placeholder={t('leverage_auto')} className="h-8 w-full rounded border border-white/10 bg-zinc-900 px-2 text-xs font-mono text-amber-200" />
                            </div>
                        </PremiumGuard>
                        <div className="space-y-1">
                            <label className="text-[9px] text-zinc-500 uppercase font-bold">{t('candle_type')}</label>
                            <select name="candle_type" value={localConfig.candle_type} onChange={handleChange} className="w-full h-8 bg-zinc-900 border border-white/10 rounded px-2 text-xs text-zinc-300">
                                <option value="STANDARD">{t('candle_standard')}</option><option value="HEIKIN_ASHI">{t('candle_heikin')}</option>
                            </select>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[9px] text-zinc-500 uppercase font-bold">{t('trading_days')}</label>
                            <div className="flex flex-wrap gap-1">
                                {daysOfWeek.map(d => (
                                    <button 
                                        key={d} 
                                        onClick={() => toggleDay(d)}
                                        className={`px-2 py-1 rounded text-[9px] border transition-colors ${localConfig.allowed_days?.includes(d) ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-zinc-800 border-white/5 text-zinc-500'}`}
                                    >
                                        {dayLabels[d]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSaveClick} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold transition-colors">
                        {t('apply_changes')}
                    </button>
                </div>
            )}
        </div>
    );
};

const BotSettingsPanel = ({ strategies, onUpdateConfig }) => {
    const strategyList = Object.entries(strategies);

    if (strategyList.length === 0) {
        return (
            <div className="panel-base rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h3 className="text-zinc-300 font-bold text-sm mb-1">No Strategies Loaded</h3>
                <p className="text-zinc-500 text-xs">Import a strategy file to configure settings.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1 bg-blue-500/10 rounded text-blue-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg></div>
                <h3 className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Strategy Configurations</h3>
            </div>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scroll">
                {strategyList.map(([name, data]) => (
                    <StrategyConfigCard 
                        key={name} 
                        name={name} 
                        config={data.config} 
                        onSave={onUpdateConfig} 
                    />
                ))}
            </div>
        </div>
    );
};

export default BotSettingsPanel;