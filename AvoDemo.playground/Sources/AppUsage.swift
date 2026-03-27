// ============================================================================
// APP USAGE EXAMPLE
// ============================================================================
// This file demonstrates the full integration flow:
// 1. Configure app-level system properties (one-time at startup)
// 2. Initialize the Avo instance in the library (optional)
// 3. Create an event struct
// 4. Call verify() to validate
// 5. Get per-destination properties (system properties already included)
// 6. Send through the customer's own analytics library
//
// This file also shows:
// - Two inspector integration patterns (automatic via send, manual via sendToInspector)
// - The no-instance path (what changes when Avo actor is not set up)
// - Smoke tests for verification
// ============================================================================

import Foundation

// ============================================================================
// SECTION 1: App Startup — Configure System Properties and Avo
// System properties are app-specific (Cooking app may differ from News app).
// They are set once at startup and automatically included in every event.
// ============================================================================

func appStartup() async -> Avo {
    // Configure system properties for THIS app
    AppSystemProperties.shared.configure(
        requiredStringSystemProperty: .iOS,
        optionalStringSystemProperty: .sock,
        requiredIntSystemProperty: 42,
        optionalIntSystemProperty: nil
    )

    // Initialize Avo (optional — see Section 6 for the no-instance path)
    let avo = await Avo.initAvo(
        env: .dev,
        inspector: nil, // Pass AvoInspector instance here when enabled
        strict: true,
        noop: false
    )
    return avo
}

// ============================================================================
// SECTION 2: App Usage — Event with verification and sending
// The app creates events, verifies them, and forwards the returned data to its own analytics backend.
// ============================================================================

func exampleTrackEventWithVerification() async {
    let avo = await appStartup()

    // Create a typed event struct
    let event = TestEventWithManyEventPropsEvent(
        requiredStringEventProperty: .beer,
        optionalStringEventProperty: .lamp,
        requiredFloatEventProperty: 42.0,
        optionalFloatEventProperty: nil,
        requiredBoolEventProperty: true,
        optionalBoolEventProperty: nil,
        requiredObjectEventProperty: AvoTypes.RequiredObjectEventProperty(
            boolValue: true, stringValue: "test", intValue: 1, floatValue: 2.0),
        optionalObjectEventProperty: nil,
        requiredListEventProperty: [.coffee, .cup],
        optionalListEventProperty: nil,
        requiredIntEventProperty: 7,
        optionalIntEventProperty: nil
    )

    // FEATURE REQUEST: "Event Verify Method in Codegen" [Must Have]
    // process() verifies the event, reports to inspector, and returns per-destination data.
    // If verification fails, it throws AvoVerificationError.
    do {
        let destinations = try await avo.process(event: event)
        // Iterate over all destinations — each gets its own AvoEventOut with name-mapped properties
        for (destinationKey, avoEventOut) in destinations {
            print("[MyAnalytics] Sending to \(destinationKey): \(avoEventOut.name)")
            print("[MyAnalytics] Properties: \(avoEventOut.properties)")
            // myAnalyticsBackend.send(destination: destinationKey, name: avoEventOut.name, properties: avoEventOut.properties)
        }
    } catch let error as AvoVerificationError {
        // Route to your own reporting infrastructure with full call-site context
        print("[MyReporting] Verification failed:")
        for message in error.messages {
            print("  - \(message)")
        }
        // In practice:
        // myReportingService.logError(
        //     fileID: #fileID,
        //     filePath: #filePath,
        //     line: #line,
        //     column: #column,
        //     messages: error.messages
        // )
    }
}

// ============================================================================
// SECTION 3: Inspector — Two Integration Patterns
// Pattern A: Automatic (inspector called inside send())
// Pattern B: Manual (caller explicitly calls sendToInspector() from app code)
// ============================================================================

func exampleInspectorPatterns() async {
    let avo = await appStartup()

    // Event 1 — Automatic inspector path
    // When process() is called, inspector is invoked automatically inside process()
    let emptyEvent = TestEmptyEventEvent()
    let destinations = (try? await avo.process(event: emptyEvent)) ?? [:] // Verifies + inspector called internally
    for (destinationKey, avoEventOut) in destinations {
        print("[MyAnalytics] Auto-inspector path [\(destinationKey)]: \(avoEventOut.name)")
    }

    // Event 2 — Manual inspector path
    // The caller decides when to report to inspector, independent of process()
    let pinnedEvent = TestPinnedPropertiesEvent(userId_: "user-123")
    await avo.sendToInspector(event: pinnedEvent) // Inspector only, no verification or analytics
    // Then read properties and send via your own path:
    let eventOut = pinnedEvent.properties["analyticsDest"]! // Safe: event struct always includes "analyticsDest" — see AppEvents.swift
    print("[MyAnalytics] Manual-inspector path: \(eventOut.name) — \(eventOut.properties)")
}

// ============================================================================
// SECTION 4: Name Mapping and Enrichment
// Demonstrates that enrichment (name mapping, pinned properties) happens
// at the app level inside the event struct's `properties` getter.
// ============================================================================

func exampleNameMapping() async {
    let avo = await appStartup()

    let event = TestAllTypesOfNameMappingEvent(
        userId_: "user-456",
        eventPropertyWithGlobalNameMappingAllDestinations: "global-all-value",
        eventPropertyWithGlobalNameMappingOneDestinationn: "global-one-value",
        eventPropertyWithLocalNameMappingOneDestination: "local-one-value",
        eventPropertyWithLocalNameMappingAllDestinations: "local-all-value",
        userPropertyWithGlobalNameMappingAllDestinations: "user-global-all",
        userPropertyWithGlobalNameMappingOneDestination: "user-global-one",
        userPropertyWithLocalNameMappingAllDestinations: "user-local-all",
        userPropertyWithLocalNameMappingOneDestination: "user-local-one"
    )

    // FEATURE REQUEST: "Automated JSON Key Formatting" [Must Have]
    // Inspect the enriched properties — keys are already name-mapped:
    let analyticsDestOut = event.properties["analyticsDest"]! // Safe: event struct always includes "analyticsDest" — see AppEvents.swift
    print("Event name for analyticsDest: \(analyticsDestOut.name)") // "EVENT_NAME_MAPPING"
    print("Properties: \(analyticsDestOut.properties)")
    // Keys are: "GLOBAL_NAME_MAPPING_ALL", "GLOBAL_NAME_MAPPING_ONE",
    //           "LOCAL_NAME_MAPPING_ONE", "LOCAL_NAME_MAPPING_ALL",
    //           plus system properties

    for (dest, avoEventOut) in (try? await avo.process(event: event)) ?? [:] {
        print("[MyAnalytics] Name-mapped event [\(dest)]: \(avoEventOut.name)")
    }
}

// ============================================================================
// SECTION 5: Smoke Tests — Verification
// Demonstrates that verify() catches schema violations and accumulates
// ALL violations (does not short-circuit on first failure).
// ============================================================================

func smokeTestVerification() {
    // Configure system properties for smoke test
    AppSystemProperties.shared.configure(
        requiredStringSystemProperty: .iOS,
        optionalStringSystemProperty: nil,
        requiredIntSystemProperty: 1,
        optionalIntSystemProperty: nil
    )

    // Create an event that violates MULTIPLE constraints:
    // - requiredFloatEventProperty > 100.0 (max violation)
    // - requiredIntEventProperty > 1000 (max violation)
    let badEvent = TestEventWithManyEventPropsEvent(
        requiredStringEventProperty: .wine,
        optionalStringEventProperty: nil,
        requiredFloatEventProperty: 999.0, // VIOLATION: max is 100.0
        optionalFloatEventProperty: nil,
        requiredBoolEventProperty: false,
        optionalBoolEventProperty: nil,
        requiredObjectEventProperty: AvoTypes.RequiredObjectEventProperty(
            boolValue: nil, stringValue: nil, intValue: 0, floatValue: 0.0),
        optionalObjectEventProperty: nil,
        requiredListEventProperty: [.phone],
        optionalListEventProperty: nil,
        requiredIntEventProperty: 9999, // VIOLATION: max is 1000
        optionalIntEventProperty: nil
    )

    do {
        try badEvent.verify()
        assert(false, "verify() should have thrown for invalid event")
    } catch let error as AvoVerificationError {
        // verify() accumulates ALL violations — does not short-circuit
        assert(error.messages.count == 2, "Should have exactly 2 violations (float max + int max)")
        print("[SmokeTest] PASS: Caught \(error.messages.count) violations:")
        for message in error.messages {
            print("  - \(message)")
        }
    } catch {
        assert(false, "Unexpected error type: \(error)")
    }

    // Valid event should not throw
    let goodEvent = TestEmptyEventEvent()
    do {
        try goodEvent.verify()
        print("[SmokeTest] PASS: Valid event passed verification")
    } catch {
        assert(false, "Valid event should not throw: \(error)")
    }

    // Verify system properties are included in event properties
    let eventOut = goodEvent.properties["analyticsDest"]! // Safe: event struct always includes "analyticsDest" — see AppEvents.swift
    assert(eventOut.properties["Required String System Property"] as? String == "iOS",
           "System properties should be included in event properties")
    print("[SmokeTest] PASS: System properties included in event output")
}

// ============================================================================
// SECTION 6: WITHOUT AVO INSTANCE — Direct Protocol Usage
// ============================================================================
// If you don't need the Avo actor (no inspector, no env gating, no noop,
// no strict, no AvoInvoke reporting), you can use AvoEvent directly:
//
//   // Configure system properties at startup (still needed)
//   AppSystemProperties.shared.configure(
//       requiredStringSystemProperty: .iOS,
//       optionalStringSystemProperty: nil,
//       requiredIntSystemProperty: 42,
//       optionalIntSystemProperty: nil
//   )
//
//   let event = TestEventWithManyEventPropsEvent(...)
//
//   // Verify
//   do {
//       try event.verify()
//   } catch let error as AvoVerificationError {
//       myReportingService.logError(error.messages)
//   }
//
//   // Get properties (system properties already included) and send yourself
//   if let avoEventOut = event.properties["analyticsDest"] {
//       myAnalyticsBackend.send(name: avoEventOut.name, properties: avoEventOut.properties)
//   }
//
// What you LOSE without the Avo instance (process()):
// - No automatic verification + inspector in one call
// - No inspector integration (automatic or manual)
// - No environment gating (all code paths run regardless of dev/staging/prod)
// - No noop mode
// - No strict mode flag
// - No AvoInvoke implementation-status reporting to Avo servers
//
// What you KEEP without the Avo instance:
// - Typed event structs with full schema enforcement
// - verify() with accumulated error messages
// - Per-destination enriched properties (name mapping, pinned properties)
// - System properties (configured via AppSystemProperties.shared)
// - AvoTypes shared enums and object structs
// ============================================================================
