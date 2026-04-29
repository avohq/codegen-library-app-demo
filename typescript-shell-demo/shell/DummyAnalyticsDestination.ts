import type { AvoDestination, AvoDestinationLogEvent, AvoEnv } from './AvoLibrary';

export interface RecordedCall {
  readonly kind: 'logEvent' | 'setUserProperties' | 'make';
  readonly payload: unknown;
  // Identifies which destination key invoked this call. Avo's library fans out
  // each track() to every destination key in the destinations record — so a
  // single button click produces one call per destination. The key here is the
  // map key (e.g. "Segment", "Amplitude", "CustomDest") that triggered it.
  readonly destinationKey?: string;
  // Identifies which app's Avo instance triggered the call (e.g. "appA" / "appB").
  // Useful in multi-app shells where the same destination object is shared.
  readonly appLabel?: string;
}

export type DestinationCallListener = (call: RecordedCall) => void;

export class DummyAnalyticsDestination implements AvoDestination {
  public readonly recordedCalls: RecordedCall[] = [];
  private listeners: Set<DestinationCallListener> = new Set();

  make(env: AvoEnv, apiKey?: string): void {
    this.record({ kind: 'make', payload: { env, apiKey } });
  }

  logEvent(event: AvoDestinationLogEvent): void {
    this.record({ kind: 'logEvent', payload: event });
  }

  setUserProperties(userId: string, properties: Record<string, unknown>): void {
    this.record({ kind: 'setUserProperties', payload: { userId, properties } });
  }

  reset(): void {
    this.recordedCalls.length = 0;
  }

  // Subscribe to destination calls — used by the demo UI to render a live log.
  // Returns an unsubscribe function. Tests don't subscribe; behavior unchanged for them.
  subscribe(listener: DestinationCallListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Internal entry point used by keyed wrappers to record a call tagged with the
  // destination key and app label that triggered it. Public so the wrappers can
  // call it; not part of the AvoDestination interface.
  recordKeyed(call: RecordedCall): void {
    this.record(call);
  }

  private record(call: RecordedCall): void {
    this.recordedCalls.push(call);
    this.listeners.forEach((fn) => fn(call));
  }
}
