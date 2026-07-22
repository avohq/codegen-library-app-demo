## Short description

Shell-level analytics wiring: a process-wide singleton (`object AvoShell`) holding one `Avo` instance per hosted app (App A, App B) plus one shared `DummyAnalyticsDestination`, and a `track` helper that verifies an event, processes it through the owning app's Avo instance, and fans the per-destination payloads out to the shared destination.

## Tech stack

Kotlin (JVM/Android). Depends on the shared generated runtime `sh.avo` (`Avo`, `AvoEnv`, `AvoEvent`, `AvoResult`, `AvoVerificationError`), the per-app generated codegen packages `com.avodemo.appa.avo` / `com.avodemo.appb.avo` (their `initAvo` factories and `AvoTypes`, disambiguated via import aliases), and the sibling `DummyAnalyticsDestination`.

## Data

- `val dummyAnalytics: DummyAnalyticsDestination` — single shared destination instance; both apps route through it.
- `val avoA: Avo`, `val avoB: Avo` — lazily initialized, one per app source; each `initAvo` embeds that app's own tracking-plan config and system properties (App A: `env=DEV`, `client=ANDROID`, `appVersion`, `sessionCount`; App B: `env=DEV`, `tenantId`, `betaFeaturesEnabled`). **Instances are independent: separate config, separate state.**
- `fun track(appLabel: String, avo: Avo, event: AvoEvent): AvoResult<List<String>, AvoVerificationError>`

## Functional requirements

`track(appLabel, avo, event)`:

1. Calls `event.verify()`; on `Failure`, returns that verification error without processing.
2. Calls `avo.process(event)`, which validates and returns a `Map<destinationKey, AvoDestinationEvent>`; a thrown `AvoVerificationError` (strict mode in dev/staging) is caught and returned as `Failure`.
3. Fans out: for each `(destinationKey, destinationEvent)` pair, calls `dummyAnalytics.logEvent(appLabel, destinationKey, destinationEvent.name, destinationEvent.properties)`.
4. Returns `Success` with the list of destination keys that received the event.

## Non-functional requirements

- **An invalid event never reaches the destination** — verification failure and strict-mode throw both short-circuit before fan-out.
- Avo instances initialize lazily on first access (`by lazy`), not at class load.
