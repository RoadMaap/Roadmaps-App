import React, { useEffect, useRef, useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import Login from './auth/Login';
import Dashboard from './components/Dashboard';
import UpdateProgressScreen from './components/UpdateProgressScreen';
import { useLanguage } from './context/LanguageContext';

function MainApp() {
  const { t } = useLanguage();
  const [view, setView] = useState('login');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('Downloading the latest version...');
  const activeDownloadRef = useRef(false);
  const forcedUpdateStartedRef = useRef(null);

  useEffect(() => {
    if (!window.eel) return;
    window.eel.expose((percent) => setDownloadProgress(percent), 'update_download_progress');

    const checkUpdate = async () => {
      if (activeDownloadRef.current) return;
      try {
        const result = await window.eel.check_for_app_update()();
        setUpdateInfo(result?.has_update ? result : null);
      } catch (error) {
        console.error('Update check failed:', error);
      }
    };

    checkUpdate();
    const pollingId = window.setInterval(checkUpdate, 3600000);
    return () => window.clearInterval(pollingId);
  }, []);

  const handleUpdateInstall = async () => {
    if (!window.eel) return;

    if (activeDownloadRef.current) return;
    activeDownloadRef.current = true;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadMessage('Downloading the latest version...');
    try {
      const result = await window.eel.download_and_install_update()();
      if (result && result.success) {
        setDownloadProgress(100);
        setDownloadMessage('Update complete. Restarting application...');
        setTimeout(() => {
          window.close();
        }, 2000);
        return;
      }

      activeDownloadRef.current = false;
      setIsDownloading(false);
      setDownloadMessage('update_install_failed');
      alert(t('update_install_failed'));
    } catch (error) {
      console.error('Install update failed:', error);
      activeDownloadRef.current = false;
      setIsDownloading(false);
      setDownloadMessage('update_install_failed');
      alert(t('update_install_failed'));
    }
  };

  const startOptionalUpdate = () => handleUpdateInstall();

  useEffect(() => {
    const version = updateInfo?.is_force_update ? updateInfo.latest_version : null;
    if (!version || isDownloading || forcedUpdateStartedRef.current === version) return;

    forcedUpdateStartedRef.current = version;
    handleUpdateInstall();
  }, [updateInfo, isDownloading, handleUpdateInstall]);

  if (updateInfo?.is_force_update === true || isDownloading) {
    return <UpdateProgressScreen progress={downloadProgress} message={downloadMessage} />;
  }

  if (view === 'login') {
    return <Login onLoginSuccess={() => setView('dashboard')} />;
  }

  return (
    <Dashboard
      updateInfo={updateInfo}
      onStartOptionalUpdate={startOptionalUpdate}
    />
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}