import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { GlobalStateProvider } from './core/state/GlobalStateManager';
import { GameRealtimeProvider } from './context/GameRealtimeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalStateProvider>
      <GameRealtimeProvider>
        <App />
      </GameRealtimeProvider>
    </GlobalStateProvider>
  </StrictMode>,
);
