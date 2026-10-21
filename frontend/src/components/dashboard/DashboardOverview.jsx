import { useLanguage } from '../../context/LanguageContext';
import { useEngineLiveData } from '../../context/EngineStateContext';
import EnginePanel from '../EnginePanel';
import RiskPanel from '../riskpanel/RiskPanel';
import NetProfit from './NetProfit';
import AccountBalance from './Account Balance/AccountBalance';
import ActivePositions from './Account Balance/ActivePositions';

const DashboardOverview = ({ initialData, nextNews, onToggleEngine }) => {
    const { t, lang } = useLanguage();
    const liveData = useEngineLiveData();
    const profit = liveData?.profit || 0;
    const positions = liveData?.positions || 0;

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:auto-rows-[156px] sm:grid-cols-[1fr_1.5fr]" dir="ltr">
                <AccountBalance className="sm:col-start-1 sm:row-start-1" />

                <div className="min-w-0 sm:col-start-2 sm:row-span-2 sm:row-start-1" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                    <NetProfit profit={profit} brokerTimeMs={liveData?.brokerTimeMs} />
                </div>

                <ActivePositions positions={positions} />
            </div>
            <div className="grid min-h-[500px] grid-cols-1 gap-4 pb-4 lg:grid-cols-12">
                <div className="min-h-[500px] lg:col-span-8"><RiskPanel initialData={initialData} nextNews={nextNews} /></div>
                <div className="min-h-[500px] lg:col-span-4">
                    <EnginePanel onToggle={onToggleEngine} />
                </div>
            </div>
        </>
    );
};

export default DashboardOverview;