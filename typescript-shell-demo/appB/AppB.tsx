import * as React from 'react';
import { useAppBActionEvent, EVENT_TYPES } from '../shell/useActionEvent';
import {
  AppBSignOutEvent,
  AppBPlanSelectedEvent,
  AppBPlan,
  type AppBPlanValue,
} from './avo/Avo';

// AppB models a different Avo source than AppA. Its plan exposes a distinct
// set of events (sign-out, plan-selected) and its own enum (AppBPlan).
const PLANS: AppBPlanValue[] = [
  AppBPlan.FREE,
  AppBPlan.PRO,
  AppBPlan.ENTERPRISE,
  AppBPlan.TRIAL,
];

export const AppB = () => {
  const trackAction = useAppBActionEvent();

  const handleSignOut = () => {
    trackAction({ event: new AppBSignOutEvent(), type: EVENT_TYPES.ACTION });
  };

  const handlePlanSelected = () => {
    const plan = PLANS[Math.floor(Math.random() * PLANS.length)] ?? PLANS[0]!;
    trackAction({
      event: new AppBPlanSelectedEvent(plan),
      type: EVENT_TYPES.ACTION,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button data-testid="track-button-b" onClick={handleSignOut}>
        Track Sign Out (App B)
      </button>
      <button data-testid="track-button-b-variant" onClick={handlePlanSelected}>
        Track Plan Selected (App B)
      </button>
    </div>
  );
};
