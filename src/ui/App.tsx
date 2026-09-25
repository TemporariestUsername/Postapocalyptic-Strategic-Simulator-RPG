import { useEffect } from 'preact/hooks';
import { Stage, Toasts } from './components/common';
import { G, useStore } from './store';
import { BootScreen, TitleScreen } from './screens/Title';
import { CreationScreen } from './screens/Creation';
import { IntroScreen } from './screens/Intro';
import { WorldScreen } from './screens/World';
import { SettlementScreen } from './screens/Settlement';
import { BattleScreen } from './screens/Battle';
import { DelveScreen } from './screens/Delve';
import { EndingScreen } from './screens/Ending';
import { SceneModal } from './screens/SceneModal';
import { Panels } from './screens/Panels';
import { installHotkeys } from './hotkeys';

export function App() {
  const { ui } = useStore();
  useEffect(() => installHotkeys(), []);
  return (
    <Stage>
      {ui.screen === 'boot' && <BootScreen />}
      {ui.screen === 'title' && <TitleScreen />}
      {ui.screen === 'creation' && <CreationScreen />}
      {ui.screen === 'intro' && <IntroScreen />}
      {ui.screen === 'world' && G.game && <WorldScreen />}
      {ui.screen === 'settlement' && G.game && <SettlementScreen />}
      {ui.screen === 'battle' && ui.battle && <BattleScreen />}
      {ui.screen === 'delve' && G.game && <DelveScreen />}
      {ui.screen === 'ending' && G.game && <EndingScreen />}
      {G.game && ui.panel && <Panels />}
      {ui.scene && <SceneModal />}
      <Toasts toasts={ui.toasts} />
    </Stage>
  );
}
