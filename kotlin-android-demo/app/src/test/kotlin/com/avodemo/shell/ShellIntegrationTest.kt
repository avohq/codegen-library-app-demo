package com.avodemo.shell

import com.avodemo.appa.avo.TestEmptyEventEvent
import com.avodemo.appa.avo.TestNameMappingEvent
import com.avodemo.appb.avo.AppBPlanSelectedEvent
import com.avodemo.appb.avo.AppBSignOutEvent
import com.avodemo.appb.avo.AvoTypes as AppBTypes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import sh.avo.AvoResult
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Shell-level integration: two hosted apps, two Avo instances, one shared
 * destination — the Kotlin analog of the typescript-shell-demo.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ShellIntegrationTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        AvoShell.dummyAnalytics.clear()
        // touch the lazy instances so both apps' system properties are configured
        AvoShell.avoA
        AvoShell.avoB
    }

    @After
    fun tearDown() {
        AvoShell.dummyAnalytics.onLog = null
        Dispatchers.resetMain()
    }

    @Test
    fun `App A event fans out to App A's destination keys`() {
        val result = AvoShell.track("appA", AvoShell.avoA, TestEmptyEventEvent)
        assertIs<AvoResult.Success<List<String>>>(result)
        assertEquals(setOf("segment", "amplitude", "mixpanel", "customDest"), result.value.toSet())

        val entries = AvoShell.dummyAnalytics.entries
        assertEquals(4, entries.size)
        assertTrue(entries.all { it.appLabel == "appA" && it.eventName == "Test Empty Event" })
    }

    @Test
    fun `App B event fans out to App B's (smaller) destination set`() {
        val result = AvoShell.track("appB", AvoShell.avoB, AppBSignOutEvent)
        assertIs<AvoResult.Success<List<String>>>(result)
        assertEquals(setOf("segment", "amplitude", "customDest"), result.value.toSet())
        assertEquals(3, AvoShell.dummyAnalytics.entries.size)
    }

    @Test
    fun `both apps share one destination but keep their own payload shapes`() {
        AvoShell.track("appA", AvoShell.avoA, TestNameMappingEvent(searchQuery = "avo", resultCount = 2))
        AvoShell.track("appB", AvoShell.avoB, AppBPlanSelectedEvent(
            plan = AppBTypes.AppBPlan.PRO, seatCount = 5, discountPercent = null))

        val entries = AvoShell.dummyAnalytics.entries
        assertEquals(4 + 3, entries.size)

        // App A's segment payload got name mapping applied by App A's codegen
        val aSegment = entries.first { it.appLabel == "appA" && it.destinationKey == "segment" }
        assertEquals("test_name_mapping", aSegment.eventName)
        assertEquals("avo", aSegment.properties["query_text"])
        assertEquals("Android", aSegment.properties["Client"], "App A system property")

        // App B's segment payload carries App B's own name mapping and system properties
        val bSegment = entries.first { it.appLabel == "appB" && it.destinationKey == "segment" }
        assertEquals("app_b_plan_selected", bSegment.eventName)
        assertEquals("tenant-42", bSegment.properties["Tenant Id"], "App B system property")
    }

    @Test
    fun `invalid event is rejected and nothing reaches the destination`() {
        val result = AvoShell.track("appB", AvoShell.avoB, AppBPlanSelectedEvent(
            plan = AppBTypes.AppBPlan.FREE, seatCount = 0, discountPercent = null))
        assertIs<AvoResult.Failure<*>>(result)
        assertTrue(AvoShell.dummyAnalytics.entries.isEmpty(), "no fan-out on verification failure")
    }
}
