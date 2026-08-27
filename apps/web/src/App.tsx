import React, { useEffect } from 'react';
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { GameProvider, useGame } from './GameContext.tsx';
import { HomeScreen } from './screens/Home.tsx';
import { StoryScreen } from './screens/Story.tsx';
import { CollectionScreen } from './screens/Collection.tsx';
import { DailyScreen, PracticeScreen, SettingsScreen, WagerScreen } from './screens/Modes.tsx';
import { PlayScreen } from './screens/PlayScreen.tsx';

function ContrastSync() {
  const { save } = useGame();
  useEffect(() => {
    document.body.classList.toggle('high-contrast', save.settings.highContrast);
  }, [save.settings.highContrast]);
  return null;
}

export function App() {
  return (
    <GameProvider>
      <HashRouter>
        <ContrastSync />
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/story" element={<StoryScreen />} />
          <Route path="/collection" element={<CollectionScreen />} />
          <Route path="/practice" element={<PracticeScreen />} />
          <Route path="/daily" element={<DailyScreen />} />
          <Route path="/wager" element={<WagerScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/play" element={<PlayScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer style={{ textAlign: 'center', padding: '2rem', color: 'var(--parchment-dim)', fontSize: 12 }}>
          <Link to="/">Sigil Grid: Ashfall</Link> · inspired by directional tactical card games
        </footer>
      </HashRouter>
    </GameProvider>
  );
}
