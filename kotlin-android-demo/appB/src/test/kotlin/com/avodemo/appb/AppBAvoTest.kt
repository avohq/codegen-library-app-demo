package com.avodemo.appb

import com.avodemo.appb.avo.AppBPlanSelectedEvent
import com.avodemo.appb.avo.AppBSignOutEvent
import com.avodemo.appb.avo.AppSystemProperties
import com.avodemo.appb.avo.AvoTrackingPlanConfig
import com.avodemo.appb.avo.AvoTypes
import com.avodemo.appb.avo.initAvo
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
import sh.avo.AvoResult
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * App B's generated code in isolation. App B's source is deliberately distinct
 * from App A's: different events, its own AppBPlan enum, different system
 * properties, and a smaller destination set (no mixpanel).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AppBAvoTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        AppSystemProperties.configure(
            tenantId = "tenant-42",
            betaFeaturesEnabled = true,
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `plan enum carries underlying tracking-plan values`() {
        assertEquals("Enterprise", AvoTypes.AppBPlan.ENTERPRISE.underlying)
    }

    @Test
    fun `sign out event carries App B system properties`() {
        val base = AppBSignOutEvent.buildBaseProperties()
        assertEquals("tenant-42", base["Tenant Id"])
        assertEquals(true, base["Beta Features Enabled"])
    }

    @Test
    fun `properties returns App B's three destinations`() {
        val props = AppBSignOutEvent.properties
        assertEquals(setOf("segment", "amplitude", "customDest"), props.keys)
    }

    @Test
    fun `plan selected is remapped for segment only`() {
        val event = AppBPlanSelectedEvent(plan = AvoTypes.AppBPlan.PRO, seatCount = 5, discountPercent = null)
        assertEquals("app_b_plan_selected", event.properties["segment"]?.name)
        assertEquals("App B Plan Selected", event.properties["amplitude"]?.name)
        assertEquals("Pro", event.properties["amplitude"]?.properties?.get("Plan"))
    }

    @Test
    fun `seat count and discount constraints are enforced`() {
        val invalid = AppBPlanSelectedEvent(plan = AvoTypes.AppBPlan.FREE, seatCount = 0, discountPercent = 150.0)
        val violations = invalid.collectViolations()
        assertTrue(violations.any { it.message.contains("Seat Count") })
        assertTrue(violations.any { it.message.contains("Discount Percent") })
        assertIs<AvoResult.Failure<*>>(invalid.verify())
    }

    @Test
    fun `valid plan selected verifies and processes`() {
        val event = AppBPlanSelectedEvent(plan = AvoTypes.AppBPlan.TRIAL, seatCount = 1, discountPercent = 100.0)
        assertIs<AvoResult.Success<Unit>>(event.verify())

        val avo = Avo(env = AvoEnv.DEV, config = AvoTrackingPlanConfig.config)
        val payloads = avo.process(event)
        assertEquals(3, payloads.size)
        assertNotNull(payloads["customDest"])
    }

    @Test
    fun `initAvo configures App B system properties`() {
        val avo = Avo.initAvo(
            env = AvoEnv.DEV,
            tenantId = "tenant-7",
            betaFeaturesEnabled = false,
            noop = true,
        )
        assertTrue(avo.process(AppBSignOutEvent).isEmpty(), "noop mode returns empty map")
        assertEquals("tenant-7", AppBSignOutEvent.buildBaseProperties()["Tenant Id"])
    }
}
