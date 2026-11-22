import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInitialPlayerState } from '../game/rules';
import { CinematicOverlay } from './CinematicOverlay';
import { HeistBreachOverlay } from './HeistBreachOverlay';
import { CustomRaceUgcSection } from './phone/CustomRaceUgcSection';
import { GlobalLeaderboardCard } from './phone/GlobalLeaderboardCard';
import { PhoneImperiumScreen } from './phone/PhoneImperiumScreen';

test('React UI components render valid HTML with expected accessibility & Grand Plan 7/8 controls', () => {
  // 1. HeistBreachOverlay renders cyber stage and CCTV EMP sabotage payout badge
  const breachHtml = renderToStaticMarkup(
    React.createElement(HeistBreachOverlay, {
      session: {
        active: true,
        heistId: 'heist_bank_sentral',
        approach: 'stealth_cyber',
        stage: 'cyber_signal',
        progress: 0,
        heat: 18,
        lockedBands: 0,
        cctvSabotaged: true,
      },
      synergyBonusPct: 12,
      onCompleteBreach: () => {},
      onCancel: () => {},
    })
  );
  assert.ok(breachHtml.includes('role="dialog"'));
  assert.ok(breachHtml.includes('CCTV &amp; Laser EMP (+15%)'));
  assert.ok(breachHtml.includes('Bonus +27%'));

  // 2. GlobalLeaderboardCard renders category switchers and test id
  const lbHtml = renderToStaticMarkup(React.createElement(GlobalLeaderboardCard));
  assert.ok(lbHtml.includes('data-testid="global-leaderboard-card"'));
  assert.ok(lbHtml.includes('Leaderboard Global Jakarta'));
  assert.ok(lbHtml.includes('ETLE'));
  assert.ok(lbHtml.includes('Balap'));
  assert.ok(lbHtml.includes('Heist'));

  // 3. CustomRaceUgcSection renders builder toggle and community catalog header
  const ugcHtml = renderToStaticMarkup(
    React.createElement(CustomRaceUgcSection, {
      protagonistName: 'Nabilo Monas',
      onStartCustomRace: () => {},
      onClosePhone: () => {},
    })
  );
  assert.ok(ugcHtml.includes('data-testid="toggle-ugc-race-builder-btn"'));
  assert.ok(ugcHtml.includes('Katalog Komunitas Online'));

  // 4. PhoneImperiumScreen renders Tier summary, leaderboard, daily challenges, turf wars & stunt ramps
  const pState = createInitialPlayerState('anak_jalanan');
  const imperiumHtml = renderToStaticMarkup(
    React.createElement(PhoneImperiumScreen, {
      playerState: pState,
      onClosePhone: () => {},
      onStartStreetRace: () => {},
      onStartCustomRace: () => {},
    })
  );
  assert.ok(imperiumHtml.includes('data-testid="phone-imperium-screen"'));
  assert.ok(imperiumHtml.includes('Imperium Jakarta'));
  assert.ok(imperiumHtml.includes('6 Stunt Ramp Jakarta'));

  // 5. CinematicOverlay renders speaker line cleanly
  const cutsceneHtml = renderToStaticMarkup(
    React.createElement(CinematicOverlay, {
      cutscene: {
        active: true,
        mode: 'heist',
        title: 'Eksekusi Brankas',
        speakerName: 'Kirana Larasati',
        subtitleText: 'Firewall brankas sudah terbuka.',
      },
      enabled: true,
      onDismiss: () => {},
    })
  );
  assert.ok(cutsceneHtml.includes('Kirana Larasati:'));
  assert.ok(cutsceneHtml.includes('Firewall brankas sudah terbuka.'));
});
