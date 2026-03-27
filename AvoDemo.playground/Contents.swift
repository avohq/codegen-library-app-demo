// ============================================================================
// Avo Split Codegen Demo — Playground
// ============================================================================
// Run this playground to see the split codegen in action.
// Source files are in the Sources/ folder:
// - AvoLibrary.swift  (Library layer — shared protocol and infrastructure)
// - AppEvents.swift   (App layer — event structs with properties + verify)
// - AppUsage.swift    (Reference examples — compiled, not auto-executed)
//
// This playground demonstrates the split codegen integration patterns.
// ============================================================================

import Foundation

// ============================================================================
// SECTION 1: Direct Protocol Usage — WITHOUT Avo Instance
// ============================================================================
// This is the simplest integration. No Avo actor needed.
// Just: configure system props → create event → verify → read properties → send.
//
// What you KEEP: typed structs, verify(), enriched properties, system properties, AvoTypes
// What you LOSE: inspector, env gating, noop, strict, AvoInvoke reporting
// ============================================================================

print("=== SECTION 1: Direct Protocol Usage (no Avo instance) ===\n")

// Step 1: Configure system properties for this app (once at startup)
AppSystemProperties.shared.configure(
    requiredStringSystemProperty: .iOS,
    optionalStringSystemProperty: .sock,
    requiredIntSystemProperty: 42,
    optionalIntSystemProperty: nil
)
print("System properties configured\n")

// Step 2: Create a typed event struct
let directEvent = TestEventWithManyEventPropsEvent(
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

// Step 3: Verify the event
do {
    try directEvent.verify()
    print("  Event verified successfully")
} catch let error as AvoVerificationError {
    print("  Verification failed: \(error.messages)")
} catch {
    print("  ERROR: Unexpected error type: \(error)")
}

// Step 4: Read per-destination properties and send to your backend
// A multi-destination app would iterate over all entries in event.properties,
// sending each AvoEventOut to its respective destination.
for (destinationKey, avoEventOut) in directEvent.properties {
    print("  Destination: \(destinationKey)")
    print("  Event name: \(avoEventOut.name)")
    print("  Property count: \(avoEventOut.properties.count)")
    print("  System prop included: \(avoEventOut.properties["Required String System Property"] ?? "MISSING")")
    // myAnalyticsBackend.send(destination: destinationKey, name: avoEventOut.name, properties: avoEventOut.properties)
}

// ============================================================================
// SECTION 2: Smoke Test — Verification
// verify() catches schema violations and accumulates ALL of them.
// ============================================================================

print("\n=== SECTION 2: Smoke Tests ===\n")

print("--- Bad Event (2 violations) ---")
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
    print("  ERROR: verify() should have thrown!")
} catch let error as AvoVerificationError {
    assert(error.messages.count == 2, "Should have exactly 2 violations (float max + int max)")
    print("  Caught \(error.messages.count) violations:")
    for message in error.messages {
        print("    - \(message)")
    }
} catch {
    print("  ERROR: Unexpected error type: \(error)")
}

print("\n--- Good Event (no violations) ---")
let goodEvent = TestEmptyEventEvent()
do {
    try goodEvent.verify()
    print("  Valid event passed verification")
} catch {
    print("  ERROR: Valid event should not throw: \(error)")
}

// ============================================================================
// SECTION 3: Name Mapping
// Keys are already formatted per workspace configuration.
// ============================================================================

print("\n=== SECTION 3: Name Mapping ===\n")

let nameMappedEvent = TestAllTypesOfNameMappingEvent(
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

for (dest, avoEventOut) in nameMappedEvent.properties {
    print("  Destination: \(dest)")
    print("  Event name (mapped): \(avoEventOut.name)") // "EVENT_NAME_MAPPING"
    print("  Property keys: \(Array(avoEventOut.properties.keys).sorted())")
}

// ============================================================================
// SECTION 4: Pinned Properties
// Constant values set at generation time, not provided by the developer.
// ============================================================================

print("\n=== SECTION 4: Pinned Properties ===\n")

let pinnedEvent = TestPinnedPropertiesEvent(userId_: "user-123")
for (_, avoEventOut) in pinnedEvent.properties {
    print("  Pinned String: \(avoEventOut.properties["Pinned String Property"] ?? "MISSING")")
    print("  Pinned Int: \(avoEventOut.properties["Pinned Int Property"] ?? "MISSING")")
    print("  Pinned Bool: \(avoEventOut.properties["Pinned Bool Property"] ?? "MISSING")")
}

// ============================================================================
// SECTION 5: Allowed Values — Compile-Time Enforcement
// The type system prevents invalid values — no runtime check needed.
// ============================================================================

print("\n=== SECTION 5: Allowed Values ===\n")

// Base event: allowed values are "Event Value I", "Value I", "Value II", "Variant with ' symbol"
let allowedValuesEvent = EventWithAllowedValuesEvent(
    eventPropertyWithAllowedValues: .valueIi // "Value II" — only available in the base event
)
for (_, avoEventOut) in allowedValuesEvent.properties {
    print("  Base event value: \(avoEventOut.properties["Event Property With Allowed Values"] ?? "MISSING")")
}

// Variant event: allowed values are DIFFERENT — "Value II" is NOT available, but "Variant Value I" IS
let variantEvent = EventWithAllowedValuesVariantIEvent(
    eventPropertyWithAllowedValues: .variantValueI // Only available in the variant
)
for (_, avoEventOut) in variantEvent.properties {
    print("  Variant event value: \(avoEventOut.properties["Event Property With Allowed Values"] ?? "MISSING")")
}

// Try uncommenting the next line — it won't compile because .valueIi is not in the variant's enum:
// let invalid = EventWithAllowedValuesVariantIEvent(eventPropertyWithAllowedValues: .valueIi) // ❌ Compile error

print("  Allowed values enforced at compile time — no verify() needed for enum properties")

// ============================================================================
// SECTION 6: With Avo Instance (async)
// Adds: verification + inspector + AvoInvoke reporting in one process() call.
// ============================================================================

print("\n=== SECTION 6: With Avo Instance ===\n")

Task {
    let avo = await Avo.initAvo(env: .dev, inspector: nil, strict: true, noop: false)

    let event = TestEventWithManyEventPropsEvent(
        requiredStringEventProperty: .cocktail,
        optionalStringEventProperty: nil,
        requiredFloatEventProperty: 50.0,
        optionalFloatEventProperty: nil,
        requiredBoolEventProperty: true,
        optionalBoolEventProperty: nil,
        requiredObjectEventProperty: AvoTypes.RequiredObjectEventProperty(
            boolValue: false, stringValue: "demo", intValue: 5, floatValue: 3.14),
        optionalObjectEventProperty: nil,
        requiredListEventProperty: [.cup],
        optionalListEventProperty: nil,
        requiredIntEventProperty: 100,
        optionalIntEventProperty: nil
    )

    // process() verifies, reports to inspector + AvoInvoke, and returns per-destination data.
    do {
        let destinations = try await avo.process(event: event)
        for (destinationKey, avoEventOut) in destinations {
            print("  Processed [\(destinationKey)]: \(avoEventOut.name)")
            print("  Properties count: \(avoEventOut.properties.count)")
            print("  System prop: \(avoEventOut.properties["Required String System Property"] ?? "MISSING")")
            // myAnalyticsBackend.send(destination: destinationKey, name: avoEventOut.name, properties: avoEventOut.properties)
        }
    } catch {
        print("  Verification failed: \(error)")
    }

    // Manual inspector path: the caller explicitly controls when inspector is invoked,
    // independently of process(). The automatic path runs inside process(event:).
    let inspectorEvent = TestEmptyEventEvent()
    await avo.sendToInspector(event: inspectorEvent)
    print("  Inspector report attempted (no-op: inspector is nil)")
}
