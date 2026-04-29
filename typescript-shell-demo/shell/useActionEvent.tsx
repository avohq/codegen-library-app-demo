import { useCallback } from 'react';
import { avoA, avoB } from './avo-shell';
import type { AvoEvent } from './AvoLibrary';

export const EVENT_TYPES = {
  ACTION: 'ACTION',
  PAGEVIEW: 'PAGEVIEW',
} as const;
export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export type TrackAction = (args: { event: AvoEvent; type: EventType }) => void;

// Small helper: creates a stable useCallback-wrapped hook that closes over the given avo instance.
// Each per-app hook (`useAppAActionEvent`, `useAppBActionEvent`) binds its own instance.
function createUseActionEvent(avoInstance: typeof avoA): () => TrackAction {
  return function useActionEvent(): TrackAction {
    return useCallback((args: { event: AvoEvent; type: EventType }) => {
      avoInstance.track(args.event);
    }, []);
  };
}

// Hook for AppA — closes over avoA (the appA Avo instance).
export const useAppAActionEvent = createUseActionEvent(avoA);

// Hook for AppB — closes over avoB (the appB Avo instance).
export const useAppBActionEvent = createUseActionEvent(avoB);
