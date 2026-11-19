import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirebaseProvider } from './context/FirebaseContext';
import { GlobalStateProvider } from './core/state/GlobalStateManager';
import { GameRealtimeProvider } from './context/GameRealtimeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FirebaseProvider>
        <GlobalStateProvider>
          <GameRealtimeProvider>
            <App />
          </GameRealtimeProvider>
        </GlobalStateProvider>
      </FirebaseProvider>
    </ErrorBoundary>
  </StrictMode>,
);
