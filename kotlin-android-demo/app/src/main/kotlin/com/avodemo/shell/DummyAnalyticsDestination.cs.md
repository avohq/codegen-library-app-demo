## Short description

Example analytics destination that records every `logEvent` call in memory so the demo UI and tests can assert on the exact fan-out: which app produced an event, which destination key it was routed to, and the (name-mapped) payload. Stands in for real analytics SDK clients (Segment, Amplitude, Mixpanel, …).

## Tech stack

Plain Kotlin (JVM/Android), no external dependencies.

## Data

- `data class LoggedEvent(appLabel: String, destinationKey: String, eventName: String, properties: Map<String, Any>)`
- `val entries: List<LoggedEvent>` — read-only snapshot of everything logged, in call order.
- `var onLog: ((LoggedEvent) -> Unit)?` — optional observer invoked once per logged event; nullable so consumers (e.g. an Activity) can detach.

## Functional requirements

- `logEvent(appLabel, destinationKey, eventName, properties)` — appends a `LoggedEvent` to the internal list, then invokes `onLog` with it if set.
- `clear()` — empties the recorded list.

## Non-functional requirements

- List mutation and snapshotting are `synchronized`; `entries` returns a defensive copy, never the live list.
- `onLog` is invoked outside the lock and on the caller's thread; observers needing a specific thread (e.g. UI) must marshal themselves.
- No I/O, no network — purely in-memory recording.
