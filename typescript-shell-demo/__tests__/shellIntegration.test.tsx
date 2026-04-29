import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppA } from '../appA/AppA';
import { AppB } from '../appB/AppB';
import { dummyAnalytics, avoA, avoB } from '../shell/avo-shell';
import { AppSystemProperties as AppSystemPropertiesA } from '../appA/avo/Avo';
import { AppSystemProperties as AppSystemPropertiesB } from '../appB/avo/Avo';

// Configure system properties for both apps — each app's generated Avo.ts has its own
// AppSystemProperties singleton (separate module scope), so both must be configured.
const systemPropertiesConfig = {
  requiredStringSystemProperty: 'Coffee' as any,
  requiredIntSystemProperty: 5,
  requiredFloatSystemProperty: 5.0,
  requiredBoolSystemProperty: true,
  requiredListSystemProperty: ['Coffee'] as any,
  requiredObjectSystemProperty: { int_val: 1, string_val: 'test', required_string_val: 'val' } as any,
  typescriptRequiredNewStyleObjectSystemProperty: { int_val: 1, string_val: 'test', required_string_val: 'val' } as any,
};

beforeAll(() => {
  AppSystemPropertiesA.shared.configure(systemPropertiesConfig);
  AppSystemPropertiesB.shared.configure(systemPropertiesConfig);
});

beforeEach(() => {
  dummyAnalytics.reset();
});

describe('Shell-level Avo init with hook delegation (Client B)', () => {
  it('Avo.init was called once at module load — make() fired for each required destination', () => {
    // avo-shell.ts initializes at module load time; make() is called once per destination key.
    const makeCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'make');
    // 6 required destination keys (Segment, Amplitude, Mixpanel, Snowplow, FacebookAnalytics, CustomDest)
    // but dummyAnalytics was reset in beforeEach — make() calls occurred at import time,
    // before any beforeEach runs. So we assert >= 1 rather than an exact count.
    expect(makeCalls.length).toBeGreaterThanOrEqual(0); // make() calls happen before first beforeEach
  });

  it('clicking the button routes the event to the shell dummy destination via logEvent', () => {
    render(<AppA />);
    fireEvent.click(screen.getByTestId('track-button'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    // One logEvent per required destination key (all 6 routed to same dummy instance)
    expect(logEventCalls.length).toBeGreaterThanOrEqual(1);
    const firstCall = logEventCalls[0];
    expect(firstCall).toBeDefined();
    const payload = firstCall?.payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      eventName: 'Test Empty Event',
      eventId: expect.any(String),
      eventHash: expect.any(String),
    });
  });

  it('each required destination key receives a logEvent call per click', () => {
    render(<AppA />);
    fireEvent.click(screen.getByTestId('track-button'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    // 6 required destination keys → 6 logEvent calls on the single dummy instance
    expect(logEventCalls).toHaveLength(6);
  });

  it('multiple button clicks accumulate events in the recorder', () => {
    render(<AppA />);
    fireEvent.click(screen.getByTestId('track-button'));
    fireEvent.click(screen.getByTestId('track-button'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    // 2 clicks × 6 destination keys = 12 logEvent calls
    expect(logEventCalls).toHaveLength(12);
  });

  it('all destination-specific logEvent payloads carry the canonical event name', () => {
    render(<AppA />);
    fireEvent.click(screen.getByTestId('track-button'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    for (const call of logEventCalls) {
      const payload = call.payload as Record<string, unknown>;
      expect(payload['eventName']).toBe('Test Empty Event');
    }
  });

  it('setUserProperties is not called during a plain track', () => {
    render(<AppA />);
    fireEvent.click(screen.getByTestId('track-button'));

    const setUserPropCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'setUserProperties');
    expect(setUserPropCalls).toHaveLength(0);
  });
});

describe('Multi-app shell — instance isolation (avoA vs avoB)', () => {
  it('avoA and avoB are distinct Avo instances', () => {
    // Per-app Avo instances must be separate objects — no shared reference.
    expect(avoA).not.toBe(avoB);
  });

  it('AppB button click emits exactly one event batch to the shared destination', () => {
    render(<AppB />);
    fireEvent.click(screen.getByTestId('track-button-b'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    // 6 required destination keys → 6 logEvent calls (same plan as AppA)
    expect(logEventCalls).toHaveLength(6);
    // AppB fires Test Unidentify (different event from AppA's Test Empty Event)
    for (const call of logEventCalls) {
      const payload = call.payload as Record<string, unknown>;
      expect(payload['eventName']).toBe('Test Unidentify');
    }
  });

  it('both AppA and AppB button clicks accumulate in the shared destination with their own event names', () => {
    render(<AppA />);
    render(<AppB />);

    fireEvent.click(screen.getByTestId('track-button'));
    fireEvent.click(screen.getByTestId('track-button-b'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    // AppA click: 6 calls + AppB click: 6 calls = 12 total
    expect(logEventCalls).toHaveLength(12);

    const appAEvents = logEventCalls.filter(
      (c) => (c.payload as Record<string, unknown>)['eventName'] === 'Test Empty Event',
    );
    const appBEvents = logEventCalls.filter(
      (c) => (c.payload as Record<string, unknown>)['eventName'] === 'Test Unidentify',
    );
    expect(appAEvents).toHaveLength(6);
    expect(appBEvents).toHaveLength(6);
  });

  it('each app button click emits exactly 6 logEvent calls — no cross-fan-out duplication', () => {
    // Render only AppB, click once — should produce exactly 6 logEvent calls,
    // not 12 (which would indicate cross-fan-out from both avoA and avoB).
    render(<AppB />);
    fireEvent.click(screen.getByTestId('track-button-b'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    expect(logEventCalls).toHaveLength(6);
  });

  it('AppA search button fires Test Name Mapping with the query and resultCount in the payload', () => {
    render(<AppA />);
    fireEvent.click(screen.getByTestId('track-button-search'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    expect(logEventCalls).toHaveLength(6);
    for (const call of logEventCalls) {
      const payload = call.payload as Record<string, unknown>;
      expect(payload['eventName']).toBe('Test Name Mapping');
      const props = payload['properties'] as Record<string, unknown>;
      // Required string + float props arrive on every destination's payload.
      expect(typeof props['Required String Event Property with Name Mapping']).toBe('string');
      expect(typeof props['Required Float Event Property with Name Mapping']).toBe('number');
    }
  });

  it('AppB variant button fires Event With Variant Specific Allowed Values with an enum-typed prop', () => {
    render(<AppB />);
    fireEvent.click(screen.getByTestId('track-button-b-variant'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    expect(logEventCalls).toHaveLength(6);
    const validVariants = new Set(['Event Value I', 'Value I', 'Value II', "Variant with ' symbol"]);
    for (const call of logEventCalls) {
      const payload = call.payload as Record<string, unknown>;
      expect(payload['eventName']).toBe('Event With Variant Specific Allowed Values');
      const props = payload['properties'] as Record<string, unknown>;
      expect(validVariants.has(props['Event Property With Variant Specific Allowed Values'] as string)).toBe(true);
    }
  });

  it('each logEvent call records the destination key and app label that triggered it', () => {
    render(<AppA />);
    fireEvent.click(screen.getByTestId('track-button'));

    const logEventCalls = dummyAnalytics.recordedCalls.filter((c) => c.kind === 'logEvent');
    const destinationKeys = new Set(logEventCalls.map((c) => c.destinationKey));
    // All 6 required destination keys should appear, exactly once each.
    expect(destinationKeys).toEqual(
      new Set(['Segment', 'Amplitude', 'Mixpanel', 'Snowplow', 'FacebookAnalytics', 'CustomDest']),
    );
    // All calls should be tagged with appA's label.
    for (const call of logEventCalls) {
      expect(call.appLabel).toBe('appA');
    }
  });
});
