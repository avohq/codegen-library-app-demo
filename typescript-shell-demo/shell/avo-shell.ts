// Shell owns the runtime + per-app configs; each app only emits its own Avo.ts (event classes).
import { Avo, AvoEnv } from './AvoLibrary';
import type { AvoDestination, AvoDestinationLogEvent } from './AvoLibrary';
import appAConfig from './appAConfig';
import appBConfig from './appBConfig';
import { DummyAnalyticsDestination } from './DummyAnalyticsDestination';

// Single shared destination instance — exercises the cross-app destination sharing pattern.
// Both Avo instances route every destination key to this same dummy.
export const dummyAnalytics = new DummyAnalyticsDestination();

// Wrap the shared dummy in a keyed proxy so each call records WHICH destination
// key (and which app) invoked it. Avo's library fans out a single track() to
// every key in the destinations record — without this wrapper, the dummy can't
// tell `Segment.logEvent` apart from `Amplitude.logEvent` because both arrive
// on the same instance.
function makeKeyedDestination(
  destinationKey: string,
  appLabel: string,
  target: DummyAnalyticsDestination,
): AvoDestination {
  return {
    make(env, apiKey) {
      target.recordKeyed({ kind: 'make', payload: { env, apiKey }, destinationKey, appLabel });
    },
    logEvent(event: AvoDestinationLogEvent) {
      target.recordKeyed({ kind: 'logEvent', payload: event, destinationKey, appLabel });
    },
    setUserProperties(userId, properties) {
      target.recordKeyed({
        kind: 'setUserProperties',
        payload: { userId, properties },
        destinationKey,
        appLabel,
      });
    },
  };
}

const destinationsA: Record<string, AvoDestination> = Object.fromEntries(
  appAConfig.requiredDestinationKeys.map((key) => [key, makeKeyedDestination(key, 'appA', dummyAnalytics)]),
);

const destinationsB: Record<string, AvoDestination> = Object.fromEntries(
  appBConfig.requiredDestinationKeys.map((key) => [key, makeKeyedDestination(key, 'appB', dummyAnalytics)]),
);

// Shell-level init: one Avo instance per app, each with its own codegenConfig.
// avoA and avoB are separate instances — they maintain independent samplingState and config,
// even though both route events to the shared dummyAnalytics destination.
export const avoA = Avo.init(
  { env: AvoEnv.Dev, destinations: destinationsA },
  appAConfig,
);

export const avoB = Avo.init(
  { env: AvoEnv.Dev, destinations: destinationsB },
  appBConfig,
);
