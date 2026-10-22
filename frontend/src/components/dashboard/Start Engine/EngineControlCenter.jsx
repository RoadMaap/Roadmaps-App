import { useLanguage } from '../../../context/LanguageContext';
import { useEngineRunning } from '../../../context/EngineStateContext';
import MorphIcon from '../../smoothui/morph-icon';
import { Status, StatusIndicator, StatusLabel } from '../../kibo-ui/status';

const EngineControlCenter = ({ onToggle, className = '' }) => {
    const { t } = useLanguage();
    const isRunning = useEngineRunning();

    return (
        <div className={`relative flex h-full min-h-[180px] shrink-0 flex-col overflow-hidden rounded-[10px] border-2 border-[#1B1B1B] bg-[#121212] p-1.5 ${className}`}>
            <div className="relative z-10 flex h-8 shrink-0 items-center justify-between gap-1 px-1.5">
                <h3 className="min-w-0 truncate text-left text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">{t('trading_engine')}</h3>
                <Status
                    status={isRunning ? 'online' : 'offline'}
                    aria-live="polite"
                    className={`h-5 shrink-0 rounded-full border-white/10 bg-[#141318] px-1.5 text-[8px] ${isRunning ? 'text-emerald-300' : 'text-zinc-400'}`}
                >
                    <StatusIndicator aria-hidden="true" />
                    <StatusLabel className={`whitespace-nowrap ${isRunning ? 'text-emerald-300' : 'text-zinc-400'}`}>
                        {isRunning ? t('processing_ticks') : t('system_offline')}
                    </StatusLabel>
                </Status>
            </div>
            <div className="relative z-10 mt-1 flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-[7px] border-2 border-[#1B1B1B] bg-[#090909] px-3 py-4">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={t('trading_engine')}
                    className={`relative z-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-full outline-none transition-all duration-500 ${
                        isRunning
                            ? 'scale-105 bg-emerald-500 text-white shadow-[0_0_50px_-10px_#10b981]'
                            : 'border-2 border-zinc-700 bg-[#18181b] text-zinc-600 hover:border-zinc-500 hover:text-zinc-300 hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]'
                    }`}
                >
                    <MorphIcon variant="play" active={isRunning} size={32} />
                    {isRunning && <span className="absolute inset-0 rounded-full border border-white/50 animate-ping opacity-50" />}
                </button>
            </div>
        </div>
    );
};

export default EngineControlCenter;