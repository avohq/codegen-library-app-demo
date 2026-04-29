# Avo Library-Interface — Shell Hosting Two Apps

A runnable reference implementation showing how a **shell** can host two
independent apps that share a single Avo runtime, each with its own per-app
config and event classes, fanning out to a shared custom destination.

This pattern fits codebases where:

- A platform / shell layer owns analytics initialization (one `Avo.init` per app source).
- Multiple feature apps live inside the shell, each generated from its own Avo plan.
- All apps need to route to the same set of analytics destinations, but the shell
  wants a single point of control over destination implementations.

## What's in the box

```
shell/
  AvoLibrary.ts                — single shared runtime (codegen output)
  appAConfig.ts                — config for App A (codegen output)
  appBConfig.ts                — config for App B (codegen output)
  avo-shell.ts                 — Avo.init for each app + destination wiring
  useActionEvent.tsx           — React hook that delegates click → track
  DummyAnalyticsDestination.ts — example destination implementation
appA/
  AppA.tsx                     — example feature app (two buttons)
  avo/
    Avo.ts                     — App A's per-event classes (codegen output)
appB/
  AppB.tsx                     — second example feature app
  avo/
    Avo.ts                     — App B's per-event classes (codegen output)
__tests__/
  shellIntegration.test.tsx    — Jest + jsdom integration tests
index.html                     — Vite entry
main.tsx                       — Demo page mounting both apps + live destination log
vite.config.ts                 — Vite config (`yarn dev` to run)
jest.config.js                 — Jest config
tsconfig.json                  — strict TypeScript
```

## Run the demo

```bash
yarn install
yarn dev
```

Open `http://localhost:5173/`. You'll see App A and App B side-by-side. Each
app has two buttons firing different events. The bottom panel renders a live
log of every callback the destination receives — tagged with which app and
which destination key triggered it.

Other scripts:

- `yarn test` — runs Jest integration tests
- `yarn typecheck` — runs `tsc --noEmit`
- `yarn build` — Vite production build

## Architecture

### File layout principle

Avo's library-interface mode emits three files per plan:

- **AvoLibrary.ts** — the runtime (Avo class, AvoEnv, BaseAvoEvent, validation
  helpers, AvoInvoke, AvoInspector types). Identical across plans for the same
  Avo SDK version.
- **AvoConfig.ts** — the codegen-bound config (schemaId, sourceId, destination
  keys, per-destination API keys, inspector key).
- **Avo.ts** — the per-event classes (one class per event in the plan).

This example collapses `AvoLibrary` to a single shared copy in `shell/` (since
all apps using the same Avo SDK version emit a byte-identical runtime), keeps
each `AvoConfig` per-app in `shell/appXConfig.ts` (renamed to avoid name
collisions when the shell imports both), and keeps each `Avo.ts` per-app in
`appX/avo/Avo.ts` (in its own folder so the codegen output is visually separated
from the app's hand-written code).

```
                ┌─────────────────────┐
                │  shell/AvoLibrary   │  (runtime, shared)
                └─────────────────────┘
                  ▲              ▲
       ┌──────────┘              └──────────┐
       │                                    │
┌──────────────┐                     ┌──────────────┐
│ appA/avo/Avo.ts  │  ◄── reads ──┐      │ appB/avo/Avo.ts  │  ◄── reads ──┐
│ event classes│              │      │ event classes│              │
└──────┬───────┘              │      └──────┬───────┘              │
       │                      │             │                      │
       │ imports              │             │ imports              │
       ▼                      │             ▼                      │
┌──────────────┐    ┌─────────┴────────┐    ┌──────────────┐       │
│appAConfig.ts │    │   shell/         │    │appBConfig.ts │       │
└──────┬───────┘    │   avo-shell.ts   │    └──────┬───────┘       │
       │            │                  │           │               │
       └────────►   │  Avo.init(A)     │   ◄───────┘               │
                    │  Avo.init(B)     │                           │
                    │                  │                           │
                    │  destinations:   │                           │
                    │   - Segment      │  fan-out per click ───►   │
                    │   - Amplitude    │                           │
                    │   - Mixpanel     │   ┌──────────────────────┐│
                    │   - Snowplow     │──►│ DummyAnalytics       ││
                    │   - Facebook     │   │ Destination          ││
                    │   - CustomDest   │   │ (shared)             ││
                    └──────────────────┘   └──────────────────────┘
```

### Init flow

1. `shell/avo-shell.ts` is imported once at module load.
2. It builds a `destinations` record per app, mapping each required destination
   key (`Segment`, `Amplitude`, ...) to a keyed proxy that delegates to the
   shared `DummyAnalyticsDestination`. The proxy tags each callback with the
   destination key so the destination knows who invoked it.
3. `Avo.init({ env, destinations }, codegenConfig)` runs once per app, returning
   a per-app `avo` instance. Each instance has independent sampling state /
   inspector / config — they don't share state, even though they share the same
   destination object.
4. `make(env, apiKey)` is called once per destination key during init.

### Track flow

1. App component instantiates one of its own per-event classes from
   `appX/Avo.ts` directly:

   ```tsx
   trackAction({ event: new TestNameMappingEvent(query, undefined, resultCount, undefined, undefined), type: EVENT_TYPES.ACTION });
   ```

2. The shell-exposed React hook (`useAppAActionEvent` /
   `useAppBActionEvent`) hands the `AvoEvent` to the matching
   `avoA.track(event)` / `avoB.track(event)`.
3. The Avo runtime runs validation against the system properties, optionally
   reports to Inspector, then iterates the `destinations` record and calls
   `dest.logEvent(...)` once per destination key.
4. Each destination receives the event payload pre-shaped for that destination
   (with name mapping, source-specific overrides, and any property bundles
   already applied by the codegen).

The trick: customers wire up real destination clients (Segment, Amplitude,
Mixpanel SDKs) inside `shell/avo-shell.ts` instead of the dummy.

### Why two apps?

The two-app setup demonstrates that:

- Each app keeps its own `Avo.ts` event-class file. Even when the same source
  generates them, the classes are distinct module-scoped instances.
- Each app has its own `AppSystemProperties` singleton — both must be
  configured before either app's events validate.
- The Avo runtime maintains independent state per `avo.init` call (e.g., the
  sampling decision is computed per-instance).
- The destinations record is per-app — you could wire Segment for App A
  but only Amplitude for App B. In this example, both apps use all six
  destinations routed through the same dummy.

## Plugging in your own Avo plan

The `Avo.ts`, `AvoConfig.ts`, and `AvoLibrary.ts` files in this example are
codegen output from a sample plan. To adapt to your own:

1. Generate your plan with the **TypeScript Library Interface** mode:

   ```bash
   avo pull --branch <yourBranch>
   ```

   (Library-interface mode emits the 3-file split this example uses.)

2. Replace `appA/avo/Avo.ts` and `shell/appAConfig.ts` with your generated
   outputs for App A. Likewise for App B if you have a second source. (The
   `avo/` subfolder is just for organization — codegen normally writes
   `Avo.ts` into a target dir of your choice; place it inside the app folder
   the way you like.)

3. Replace `shell/AvoLibrary.ts` with the runtime from your codegen (it should
   be byte-identical to App A's and App B's, since the same Avo SDK version
   produces the same runtime).

4. Update import paths inside `appA/avo/Avo.ts` and `appB/avo/Avo.ts` so the runtime /
   config imports point at the shell locations:

   ```ts
   // in appA/avo/Avo.ts
   import { /* ... */ } from '../../shell/AvoLibrary';
   import type { DestinationKey } from '../../shell/appAConfig';

   export { Avo, AvoEnv, AvoVerificationError, BaseAvoEvent, AvoAssert } from '../../shell/AvoLibrary';
   export type { AvoDestination, AvoEvent, AvoDestinationEvent, AvoDestinationLogEvent, AvoInspector, AvoAssertMessage } from '../../shell/AvoLibrary';
   ```

5. Update each app's component file (`appX/AppX.tsx`) to import and instantiate
   your real per-event classes from `appX/Avo.ts` (replacing the example uses
   of `TestEmptyEventEvent`, `TestNameMappingEvent`, etc.).

6. Update `shell/avo-shell.ts` to wire up your real destination
   implementations instead of the `DummyAnalyticsDestination`. Implement the
   `AvoDestination` interface (`make`, `logEvent`, `setUserProperties`) for
   each real destination client (Segment, Amplitude, Mixpanel, ...).

## Pre-existing codegen quirks worth knowing

The two `Avo.ts` files in this example were patched after codegen to address
two issues that strict-ESM bundlers (Vite, esbuild, Rollup) reject but TypeScript
tolerates via `// @ts-nocheck`. If you regenerate from your own plan, you may
need to apply the same fixes:

1. **Duplicate `export const X = {...} as const;` enum blocks.** The codegen
   emits some enum exports twice (once in the main pass, once in the
   destinations pass). Remove the second occurrence and the two
   `export type XType` / `export type XValueType` lines that follow it.

2. **Type-only re-exports in value position.** The codegen consolidates a
   re-export line like:

   ```ts
   export { Avo, AvoEnv, AvoDestination, AvoEvent, ... } from '../../shell/AvoLibrary';
   ```

   `AvoDestination`, `AvoEvent`, `AvoDestinationEvent`, `AvoDestinationLogEvent`,
   `AvoInspector`, and `AvoAssertMessage` are TypeScript interfaces (types only,
   no runtime export). Strict-ESM bundlers will fail with "X is not exported".
   Split the line into a value-position and a type-position export:

   ```ts
   export { Avo, AvoEnv, AvoVerificationError, BaseAvoEvent, AvoAssert } from '../../shell/AvoLibrary';
   export type { AvoDestination, AvoEvent, AvoDestinationEvent, AvoDestinationLogEvent, AvoInspector, AvoAssertMessage } from '../../shell/AvoLibrary';
   ```

Both fixes are mechanical and reproducible. A future Avo SDK release will
likely emit the correct shape directly.

## License

Provided as an example. Adapt freely.
