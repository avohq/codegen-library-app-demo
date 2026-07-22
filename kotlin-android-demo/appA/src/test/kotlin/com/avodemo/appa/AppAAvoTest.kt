package com.avodemo.appa

import com.avodemo.appa.avo.AppSystemProperties
import com.avodemo.appa.avo.AvoTrackingPlanConfig
import com.avodemo.appa.avo.AvoTypes
import com.avodemo.appa.avo.TestEmptyEventEvent
import com.avodemo.appa.avo.TestNameMappingEvent
import com.avodemo.appa.avo.initAvo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import sh.avo.Avo
import sh.avo.AvoEnv
import sh.avo.AvoEvent
import sh.avo.AvoResult
import sh.avo.AvoVerificationError
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * App A's generated code in isolation: source-specific events + config from
 * this module, runtime types from the shared :library module.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AppAAvoTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        AppSystemProperties.configure(
            client = AvoTypes.Client.ANDROID,
            appVersion = "1.0.0",
            sessionCount = 3,
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `events implement the library AvoEvent interface`() {
        val event: AvoEvent = TestEmptyEventEvent
        assertEquals("Test Empty Event", event.eventName)
        assertNotNull(event.eventId)
        assertEquals(64, event.eventHash.length, "SHA-256 hex hash")
    }

    @Test
    fun `verify succeeds once system properties are configured`() {
        assertIs<AvoResult.Success<Unit>>(TestEmptyEventEvent.verify())
    }

    @Test
    fun `system properties flow into every event`() {
        val base = TestEmptyEventEvent.buildBaseProperties()
        assertEquals("Android", base["Client"])
        assertEquals("1.0.0", base["App Version"])
        assertEquals(3, base["Session Count"])
    }

    @Test
    fun `properties returns App A's four destinations`() {
        val props = TestNameMappingEvent(searchQuery = "avo", resultCount = 1).properties
        assertEquals(setOf("segment", "amplitude", "mixpanel", "customDest"), props.keys)
    }

    @Test
    fun `segment gets remapped event and property names`() {
        val props = TestNameMappingEvent(searchQuery = "avo", resultCount = 1).properties
        assertEquals("test_name_mapping", props["segment"]?.name)
        assertEquals("avo", props["segment"]?.properties?.get("query_text"))
        assertEquals(null, props["segment"]?.properties?.get("Search Query"))
        // other destinations keep the original names
        assertEquals("Test Name Mapping", props["amplitude"]?.name)
        assertEquals("avo", props["amplitude"]?.properties?.get("Search Query"))
    }

    @Test
    fun `negative result count violates the min constraint`() {
        val violations = TestNameMappingEvent(searchQuery = "avo", resultCount = -1).collectViolations()
        assertTrue(violations.any { it.message.contains("minimum") })
    }

    @Test
    fun `process in strict dev mode throws on violations`() {
        val avo = Avo(env = AvoEnv.DEV, config = AvoTrackingPlanConfig.config, strict = true)
        var thrown = false
        try {
            avo.process(TestNameMappingEvent(searchQuery = "avo", resultCount = -1))
        } catch (e: AvoVerificationError) {
            thrown = true
        }
        assertTrue(thrown, "strict mode should throw AvoVerificationError")
    }

    @Test
    fun `initAvo wires system properties and returns a working instance`() {
        val avo = Avo.initAvo(
            env = AvoEnv.DEV,
            client = AvoTypes.Client.WEB,
            appVersion = "2.0.0",
            sessionCount = null,
            noop = true,
        )
        assertTrue(avo.process(TestEmptyEventEvent).isEmpty(), "noop mode returns empty map")
        assertEquals("Web", TestEmptyEventEvent.buildBaseProperties()["Client"])
    }
}
