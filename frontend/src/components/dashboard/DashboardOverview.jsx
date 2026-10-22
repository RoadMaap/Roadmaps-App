import { useLanguage } from '../../context/LanguageContext';
import { useEngineLiveData } from '../../context/EngineStateContext';
import EnginePanel from '../EnginePanel';
import EngineControlCenter from './Start Engine/EngineControlCenter';
import RiskPanel from '../riskpanel/RiskPanel';
import NetProfit from './Net Profit/NetProfit';
import AccountBalance from './Account Balance/AccountBalance';
import ActivePositions from './Active Positions/ActivePositions';

const DashboardOverview = ({ initialData, nextNews, onToggleEngine }) => {
    const { t, lang } = useLanguage();
    const liveData = useEngineLiveData();
    const profit = liveData?.profit || 0;
    const positions = liveData?.positions || 0;

    return (
        <>
            <div className="dashboard-overview-grid grid grid-cols-1 gap-4 min-[560px]:grid-cols-[1fr_1fr] min-[560px]:grid-rows-[156px_minmax(260px,auto)] lg:grid-cols-[1fr_1.5fr] lg:grid-rows-[156px_156px] min-[1400px]:grid-cols-[360px_680px_calc((100%_-_176px)_/_6_+_24px)] min-[1400px]:grid-rows-[156px_156px] min-[1400px]:justify-end" dir="ltr">
                <AccountBalance className="min-[560px]:col-start-1 min-[560px]:row-start-1" />

                <div className="min-w-0 min-[560px]:col-span-2 min-[560px]:row-start-2 lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                    <NetProfit profit={profit} brokerTimeMs={liveData?.brokerTimeMs} />
                </div>

                <ActivePositions positions={positions} className="min-[560px]:col-start-2 min-[560px]:row-start-1 lg:col-start-1 lg:row-start-2" />
                <EngineControlCenter onToggle={onToggleEngine} className="hidden min-[1400px]:col-start-3 min-[1400px]:row-span-2 min-[1400px]:row-start-1 min-[1400px]:flex" />
            </div>
            <div className="grid min-h-[500px] grid-cols-1 gap-4 pb-4 lg:grid-cols-12">
                <div className="min-h-[500px] lg:col-span-8"><RiskPanel initialData={initialData} nextNews={nextNews} /></div>
                <div className="min-h-[500px] lg:col-span-4">
                    <EnginePanel onToggle={onToggleEngine} controlCenterClassName="min-[1400px]:hidden" />
                </div>
            </div>
        </>
    );
};

export default DashboardOverview;