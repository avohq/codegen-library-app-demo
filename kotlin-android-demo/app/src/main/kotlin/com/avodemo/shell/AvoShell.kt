package com.avodemo.shell

import sh.avo.Avo
import sh.avo.AvoEnv
import sh.avo.AvoEvent
import sh.avo.AvoResult
import sh.avo.AvoVerificationError

// Each app's generated code lives in its own package, so the same-named
// symbols (initAvo, AvoTypes) are disambiguated with import aliases.
import com.avodemo.appa.avo.initAvo as initAppAAvo
import com.avodemo.appb.avo.initAvo as initAppBAvo
import com.avodemo.appa.avo.AvoTypes as AppATypes

/**
 * Shell-level analytics wiring: one Avo instance per hosted app, both fanning
 * out to a single shared destination.
 *
 * In the Kotlin library-interface mode, `avo.process(event)` validates the
 * event and returns a `Map<destinationKey, AvoDestinationEvent>` — the shell
 * decides what to do with each per-destination payload. That keeps a single
 * point of control over destination implementations while every hosted app
 * keeps its own generated event classes and tracking-plan config.
 */
object AvoShell {

    // Single shared destination instance — both apps route through it.
    val dummyAnalytics = DummyAnalyticsDestination()

    // One Avo instance per app source. Each initAvo configures that app's own
    // AppSystemProperties singleton and embeds that app's tracking-plan config.
    // Instances are independent: separate config, separate sampling state.
    val avoA: Avo by lazy {
        Avo.initAppAAvo(
            env = AvoEnv.DEV,
            client = AppATypes.Client.ANDROID,
            appVersion = "1.0.0",
            sessionCount = 1,
        )
    }

    val avoB: Avo by lazy {
        Avo.initAppBAvo(
            env = AvoEnv.DEV,
            tenantId = "tenant-42",
            betaFeaturesEnabled = true,
        )
    }

    /**
     * Track one event from one hosted app: verify, process, then fan the
     * per-destination payloads out to the shared destination.
     *
     * Returns the destination keys that received the event, or the
     * verification error if the event was invalid.
     */
    fun track(appLabel: String, avo: Avo, event: AvoEvent): AvoResult<List<String>, AvoVerificationError> {
        when (val verification = event.verify()) {
            is AvoResult.Failure -> return AvoResult.Failure(verification.error)
            is AvoResult.Success -> Unit
        }

        val payloads = try {
            avo.process(event)
        } catch (e: AvoVerificationError) {
            // strict mode throws in dev/staging on validation violations
            return AvoResult.Failure(e)
        }

        payloads.forEach { (destinationKey, destinationEvent) ->
            dummyAnalytics.logEvent(
                appLabel = appLabel,
                destinationKey = destinationKey,
                eventName = destinationEvent.name,
                properties = destinationEvent.properties,
            )
        }
        return AvoResult.Success(payloads.keys.toList())
    }
}
