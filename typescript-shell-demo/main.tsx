import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { AppA } from './appA/AppA';
import { AppB } from './appB/AppB';
import { dummyAnalytics } from './shell/avo-shell';
import type { RecordedCall } from './shell/DummyAnalyticsDestination';
import { AppSystemProperties as AppSystemPropertiesA } from './appA/avo/Avo';
import { AppSystemProperties as AppSystemPropertiesB } from './appB/avo/Avo';

// Each app's generated Avo.ts exports its own AppSystemProperties singleton (separate
// module scope). Shell configures both before render so verify() doesn't throw.
const systemPropertiesConfig = {
  requiredStringSystemProperty: 'Coffee' as any,
  requiredIntSystemProperty: 5,
  requiredFloatSystemProperty: 5.0,
  requiredBoolSystemProperty: true,
  requiredListSystemProperty: ['Coffee'] as any,
  requiredObjectSystemProperty: { int_val: 1, string_val: 'test', required_string_val: 'val' } as any,
  typescriptRequiredNewStyleObjectSystemProperty: { int_val: 1, string_val: 'test', required_string_val: 'val' } as any,
};
AppSystemPropertiesA.shared.configure(systemPropertiesConfig);
AppSystemPropertiesB.shared.configure(systemPropertiesConfig);

interface LogEntry {
  readonly id: number;
  readonly ts: string;
  readonly call: RecordedCall;
}

let nextLogId = 0;

function eventNameOf(call: RecordedCall): string | undefined {
  if (call.kind !== 'logEvent') return undefined;
  const payload = call.payload as Record<string, unknown>;
  return typeof payload.eventName === 'string' ? payload.eventName : undefined;
}

function DestinationLog() {
  const [entries, setEntries] = React.useState<LogEntry[]>([]);

  React.useEffect(() => {
    const unsubscribe = dummyAnalytics.subscribe((call) => {
      const entry: LogEntry = {
        id: nextLogId++,
        ts: new Date().toLocaleTimeString(),
        call,
      };
      // Mirror to the browser console too — useful for copy-paste / DevTools filtering.
      // eslint-disable-next-line no-console
      console.log(
        `[Avo dummy ${call.appLabel ?? '?'}/${call.destinationKey ?? '?'}]`,
        call.kind,
        call.payload,
      );
      setEntries((prev) => [entry, ...prev].slice(0, 200));
    });
    return unsubscribe;
  }, []);

  return (
    <div style={styles.logPanel}>
      <div style={styles.logHeader}>
        <strong>Destination call log</strong>
        <span style={styles.logHeaderHint}>
          Each click fires once per destination key — Avo fans out to all required destinations.
        </span>
        <button onClick={() => setEntries([])} style={styles.clearButton}>
          Clear
        </button>
      </div>
      {entries.length === 0 ? (
        <div style={styles.logEmpty}>No calls yet — click a button above.</div>
      ) : (
        <ol style={styles.logList}>
          {entries.map((e) => {
            const eventName = eventNameOf(e.call);
            return (
              <li key={e.id} style={styles.logItem}>
                <span style={styles.logTs}>{e.ts}</span>
                <span style={styles.logKind(e.call.kind)}>{e.call.kind}</span>
                <span style={styles.logTags}>
                  {e.call.appLabel && <span style={styles.tagApp}>{e.call.appLabel}</span>}
                  {e.call.destinationKey && (
                    <span style={styles.tagDestination}>{e.call.destinationKey}</span>
                  )}
                  {eventName && <span style={styles.tagEvent}>{eventName}</span>}
                </span>
                <pre style={styles.logPayload}>{JSON.stringify(e.call.payload, null, 2)}</pre>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function Demo() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Avo library-interface shell demo</h1>
      <p style={styles.subtitle}>
        Two independent apps share the shell's Avo runtime. Each app has its own Avo
        instance and config and fires a different event. Both route every required
        destination key (Segment, Amplitude, Mixpanel, Snowplow, FacebookAnalytics,
        CustomDest) to a shared <code>DummyAnalyticsDestination</code> — so each click
        shows up <strong>once per destination</strong> in the log below.
      </p>
      <div style={styles.appsRow}>
        <section style={styles.appCard}>
          <h2 style={styles.appTitle}>App A</h2>
          <AppA />
        </section>
        <section style={styles.appCard}>
          <h2 style={styles.appTitle}>App B</h2>
          <AppB />
        </section>
      </div>
      <DestinationLog />
    </div>
  );
}

const styles = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: 960,
    margin: '0 auto',
    padding: '32px 24px',
  } as React.CSSProperties,
  title: { margin: 0, fontSize: 28 } as React.CSSProperties,
  subtitle: { color: '#444', lineHeight: 1.5 } as React.CSSProperties,
  appsRow: {
    display: 'flex',
    gap: 16,
    margin: '24px 0',
  } as React.CSSProperties,
  appCard: {
    flex: 1,
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 16,
    background: '#fafafa',
  } as React.CSSProperties,
  appTitle: { marginTop: 0, fontSize: 18 } as React.CSSProperties,
  logPanel: {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 16,
    background: '#fff',
  } as React.CSSProperties,
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  logHeaderHint: {
    color: '#666',
    fontSize: 12,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  clearButton: {
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,
  logEmpty: { color: '#999', fontStyle: 'italic' } as React.CSSProperties,
  logList: { listStyle: 'none', padding: 0, margin: 0 } as React.CSSProperties,
  logItem: {
    borderTop: '1px solid #eee',
    padding: '8px 0',
    display: 'grid',
    gridTemplateColumns: '80px 110px minmax(280px, auto) 1fr',
    gap: 8,
    alignItems: 'start',
  } as React.CSSProperties,
  logTs: { color: '#888', fontFamily: 'monospace', fontSize: 12 } as React.CSSProperties,
  logKind: (kind: RecordedCall['kind']) =>
    ({
      fontFamily: 'monospace',
      fontSize: 12,
      fontWeight: 600,
      color: kind === 'logEvent' ? '#0066cc' : kind === 'make' ? '#7a3a00' : '#5a008a',
    }) as React.CSSProperties,
  logTags: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  tagApp: {
    fontFamily: 'monospace',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 3,
    background: '#e8f0fe',
    color: '#1857c4',
  } as React.CSSProperties,
  tagDestination: {
    fontFamily: 'monospace',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 3,
    background: '#fef3c7',
    color: '#92400e',
  } as React.CSSProperties,
  tagEvent: {
    fontFamily: 'monospace',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 3,
    background: '#dcfce7',
    color: '#166534',
  } as React.CSSProperties,
  logPayload: {
    fontFamily: 'monospace',
    fontSize: 11,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#333',
  } as React.CSSProperties,
};

const root = createRoot(document.getElementById('root')!);
root.render(<Demo />);
