# Avo Library Interface — Kotlin/Android Shell Hosting Two Apps

A runnable reference implementation showing how an Android **shell app** can
host two independent feature apps that share a single Avo runtime module, each
with its own per-app generated events and tracking-plan config, fanning out to
a shared custom destination.

This is the Kotlin/Android analog of the [`typescript-shell-demo`](../typescript-shell-demo)
in this repo, using Avo's [library codegen mode](https://www.avo.app/docs/reference/avo-codegen/library-codegen).

This pattern fits codebases where:

- A platform / shell layer owns analytics initialization (one Avo instance per
  app source) and the destination implementations.
- Multiple feature apps (Gradle modules) live inside the shell, each generated
  from its own Avo source / plan.
- The generated runtime should be shared — published once as a library module
  instead of duplicated into every app.

## What's in the box

```
library/                              — :library (com.android.library)
  src/main/kotlin/sh/avo/
    AvoLibraryInterface.kt            — the shared Avo runtime (codegen output)
appA/                                 — :appA (com.android.library)
  src/main/kotlin/com/avodemo/appa/avo/
    Avo.kt                            — App A's events + config (codegen output)
  src/test/.../AppAAvoTest.kt         — App A in isolation
appB/                                 — :appB (com.android.library)
  src/main/kotlin/com/avodemo/appb/avo/
    Avo.kt                            — App B's events + config (codegen output)
  src/test/.../AppBAvoTest.kt         — App B in isolation
app/                                  — :app (com.android.application, the shell)
  src/main/kotlin/com/avodemo/shell/
    AvoShell.kt                       — one Avo instance per app + fan-out
    DummyAnalyticsDestination.kt      — example destination implementation
    MainActivity.kt                   — demo screen: both apps + live log
  src/test/.../ShellIntegrationTest.kt — cross-app integration tests
```

## Run the demo

```bash
./gradlew :appA:testDebugUnitTest :appB:testDebugUnitTest :app:testDebugUnitTest
```

runs the whole flow as JVM unit tests (no emulator needed). Or install the
shell on a device/emulator:

```bash
./gradlew :app:installDebug
```

The screen shows App A and App B sections, each with two buttons firing events
from its own Avo source — App A fires `Test Empty Event` / `Test Name Mapping`;
App B fires `App B Sign Out` / `App B Plan Selected`. The bottom panel renders
a live log of every payload the shared destination receives, tagged with which
app and destination key produced it.

## Architecture

### File layout principle

Avo's Kotlin library-interface mode emits two files per source:

- **AvoLibraryInterface.kt** — the runtime (`Avo` class, `AvoEvent` interface,
  `AvoEnv`, `AvoDestinationEvent`, `AvoResult`, validation helpers, `AvoInvoke`).
  Identical for every source generated with the same Avo SDK version.
- **Avo.kt** — the source-specific file: one class/object per event,
  `AvoTypes` enums, the `AppSystemProperties` singleton, the embedded
  `AvoTrackingPlanConfig`, and the `Avo.Companion.initAvo` convenience
  extension.

This example keeps a single shared copy of the runtime in the `:library`
module (real codebases can publish it as an internal artifact), and one
`Avo.kt` per app module. Each app's file is generated into its own package
(`com.avodemo.appa.avo` / `com.avodemo.appb.avo` instead of the default
`sh.avo`) so the shell can depend on both without class-name collisions.

```
                    ┌─────────────────────────────┐
                    │  :library                   │
                    │  sh.avo.AvoLibraryInterface │   (runtime, shared)
                    └─────────────────────────────┘
                        ▲                   ▲
             api        │                   │        api
        ┌───────────────┘                   └───────────────┐
┌───────────────────────┐               ┌───────────────────────┐
│ :appA                 │               │ :appB                 │
│ com.avodemo.appa.avo  │               │ com.avodemo.appb.avo  │
│  events, AvoTypes,    │               │  events, AppBPlan,    │
│  config, initAvo      │               │  config, initAvo      │
└───────────────────────┘               └───────────────────────┘
                        ▲                   ▲
                        └───────┬───────────┘
                                │ implementation
                    ┌─────────────────────────────┐
                    │  :app (shell)               │
                    │  avoA = Avo.initAvo(...)    │
                    │  avoB = Avo.initAvo(...)    │
                    │  avo.process(event) ──────► │──► DummyAnalytics
                    │  fan out per destination    │    Destination (shared)
                    └─────────────────────────────┘
```

### Init flow

1. The shell (`AvoShell`) creates one `Avo` instance per hosted app by calling
   each app's generated `initAvo` extension (import-aliased, since both are
   named `initAvo` on `Avo.Companion`).
2. Each `initAvo` configures that app's own `AppSystemProperties` singleton and
   embeds that app's `AvoTrackingPlanConfig` (schema/source/action IDs).
3. The instances are independent — separate config, separate sampling state —
   even though the shell routes both to the same destination object.

### Track flow

1. An app component instantiates one of its own generated event classes:

   ```kotlin
   AppBPlanSelectedEvent(plan = AvoTypes.AppBPlan.PRO, seatCount = 5, discountPercent = 10.0)
   ```

2. The shell verifies it (`event.verify()` returns `AvoResult`) and hands it to
   the matching instance: `avoB.process(event)`.
3. `process` validates in dev/staging (strict mode throws
   `AvoVerificationError` on violations, and nothing is sent), optionally
   reports to Inspector, and returns `Map<destinationKey, AvoDestinationEvent>`
   with name mapping and per-destination overrides already applied.
4. The shell iterates the map and calls the destination implementation once per
   key. In a real codebase you'd dispatch to actual Segment / Amplitude /
   Mixpanel SDK clients here instead of the dummy.

### Why two apps?

- Each app keeps its own generated `Avo.kt` from its own Avo source. App A's
  surface (`Test Empty Event`, `Test Name Mapping`) and App B's surface
  (`App B Sign Out`, `App B Plan Selected`, plus its own `AppBPlan` enum) are
  completely disjoint; each app only knows its own events.
- Each app has its own `AppSystemProperties` singleton and its own destination
  set — App A routes to four keys, App B to three (no mixpanel).
- Name mapping is per-source: App A remaps `Test Name Mapping` (and the
  `Search Query` property) for segment; App B remaps `App B Plan Selected`.

## Plugging in your own Avo plan

The `Avo.kt` files here are example codegen output. To adapt to your own plan:

1. Generate each source with the Kotlin library-interface mode:

   ```bash
   avo pull --forceFeatures KotlinLibraryInterface
   ```

   (Or ask Avo support to enable the feature by default for your workspace.)

2. Put the generated `AvoLibraryInterface.kt` in your shared library module.
   It is identical across sources for the same Avo SDK version — keep one copy.

3. Put each source's generated `Avo.kt` in that app's module. If a single
   binary bundles several apps, give each file its own package (as done here)
   so the same-named symbols don't collide, and import-alias `initAvo` /
   `AvoTypes` at the call site.

4. Replace `DummyAnalyticsDestination` wiring in `AvoShell` with your real
   destination clients — one `logEvent` per entry of the map returned by
   `avo.process(event)`.

## License

Provided as an example. Adapt freely.
