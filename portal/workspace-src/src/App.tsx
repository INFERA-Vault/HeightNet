import { useEffect } from 'react';
import { AppShell } from './components/shell/AppShell';
import { Dedicated3DViewer } from './components/viewer/Dedicated3DViewer';
import { useAppStore } from './state/appStore';

export function App() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const setCurrentScreen = useAppStore((state) => state.setCurrentScreen);
  const setActiveView = useAppStore((state) => state.setActiveView);

  useEffect(() => {
    const handlePopState = () => {
      const isViewer = window.location.pathname.startsWith('/viewer/3d');
      if (isViewer) {
        setActiveView('3D');
        setCurrentScreen('dedicated_3d_viewer');
      } else {
        setCurrentScreen('workspace');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentScreen, setActiveView]);

  if (currentScreen === 'dedicated_3d_viewer') {
    return <Dedicated3DViewer />;
  }

  return <AppShell />;
}

export default App;
