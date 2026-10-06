import React, { useEffect, useRef, useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import Login from './auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import UpdateProgressScreen from './components/UpdateProgressScreen';
import { useLanguage } from './context/LanguageContext';

function toStrictBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'y', 'on', 'required', 'forced'].includes(value.trim().toLowerCase());
  }
  return value === 1;
}

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
        const forceValue = result?.is_force_update ?? result?.force_update ?? result?.force ?? result?.required;
        const normalizedResult = result
          ? {
              ...result,
              has_update: toStrictBoolean(result.has_update),
              is_force_update: toStrictBoolean(forceValue),
            }
          : null;
        if (normalizedResult?.has_update && normalizedResult.is_force_update !== true) {
          console.log('[Updater] Waiting for user confirmation');
        }
        setUpdateInfo(normalizedResult?.has_update ? normalizedResult : null);
      } catch (error) {
        console.error('Update check failed:', error);
      }
    };

    checkUpdate();
    const pollingId = window.setInterval(checkUpdate, 3600000);
    return () => window.clearInterval(pollingId);
  }, []);

  const handleUpdateInstall = async (startReason) => {
    if (!window.eel) return;

    if (activeDownloadRef.current) return;
    activeDownloadRef.current = true;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadMessage('Downloading the latest version...');
    try {
      console.log(`[Updater] Starting download: ${startReason}`);
      const result = await window.eel.download_and_install_update()();
      if (result && result.success) {
        setDownloadProgress(100);
        setDownloadMessage('Update complete. Restarting application...');
        setTimeout(() => {
          window.close();
        }, 2000);
        return;
      }

      const failureMessage = result?.message || t('update_install_failed');
      activeDownloadRef.current = false;
      setIsDownloading(false);
      setDownloadMessage(failureMessage);
      alert(failureMessage);
    } catch (error) {
      console.error('Install update failed:', error);
      activeDownloadRef.current = false;
      setIsDownloading(false);
      const failureMessage = error instanceof Error ? error.message : t('update_install_failed');
      setDownloadMessage(failureMessage);
      alert(failureMessage);
    }
  };

  const startOptionalUpdate = () => handleUpdateInstall('user clicked Update Now');

  useEffect(() => {
    // The string "false" is truthy in JavaScript, so forced installs require a normalized boolean.
    const version = updateInfo?.is_force_update === true ? updateInfo.latest_version : null;
    if (!version || isDownloading || forcedUpdateStartedRef.current === version) return;

    forcedUpdateStartedRef.current = version;
    handleUpdateInstall('Auto-starting: force update');
  }, [updateInfo, isDownloading, handleUpdateInstall]);

  if (isDownloading) {
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