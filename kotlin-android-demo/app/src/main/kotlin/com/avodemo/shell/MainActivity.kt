package com.avodemo.shell

import android.app.Activity
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import sh.avo.Avo
import sh.avo.AvoEvent
import sh.avo.AvoResult

import com.avodemo.appa.avo.TestEmptyEventEvent
import com.avodemo.appa.avo.TestNameMappingEvent
import com.avodemo.appb.avo.AppBSignOutEvent
import com.avodemo.appb.avo.AppBPlanSelectedEvent
import com.avodemo.appb.avo.AvoTypes as AppBTypes

/**
 * Demo shell screen: App A and App B side by side, each firing events from its
 * own Avo source, with a live log of every payload the shared destination
 * receives — tagged with the app and destination key that produced it.
 */
class MainActivity : Activity() {

    private lateinit var logView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        root.addView(sectionTitle("App A (own Avo source)"))
        root.addView(trackButton("Fire: Test Empty Event") {
            track("appA", AvoShell.avoA, TestEmptyEventEvent)
        })
        root.addView(trackButton("Fire: Test Name Mapping") {
            track("appA", AvoShell.avoA, TestNameMappingEvent(searchQuery = "avo toast", resultCount = 3))
        })

        root.addView(sectionTitle("App B (own Avo source)"))
        root.addView(trackButton("Fire: App B Sign Out") {
            track("appB", AvoShell.avoB, AppBSignOutEvent)
        })
        root.addView(trackButton("Fire: App B Plan Selected") {
            track("appB", AvoShell.avoB, AppBPlanSelectedEvent(
                plan = AppBTypes.AppBPlan.PRO,
                seatCount = 5,
                discountPercent = 10.0,
            ))
        })

        root.addView(sectionTitle("Destination log"))
        logView = TextView(this).apply {
            typeface = Typeface.MONOSPACE
            textSize = 11f
        }
        root.addView(ScrollView(this).apply { addView(logView) })

        setContentView(root)

        // Rebuild the log from everything the destination has already received,
        // so the view survives rotation / activity recreation.
        val backlog = AvoShell.dummyAnalytics.entries
        logView.text =
            if (backlog.isEmpty()) EMPTY_LOG
            else backlog.asReversed().joinToString("\n", transform = ::formatEntry)

        AvoShell.dummyAnalytics.onLog = { entry ->
            runOnUiThread { appendLogLine(formatEntry(entry)) }
        }
    }

    override fun onDestroy() {
        // dummyAnalytics is a process-wide singleton; drop the callback so it
        // doesn't retain this activity after rotation/navigation.
        AvoShell.dummyAnalytics.onLog = null
        super.onDestroy()
    }

    private companion object {
        const val EMPTY_LOG = "— no events yet —"
    }

    private fun track(appLabel: String, avo: Avo, event: AvoEvent) {
        when (val result = AvoShell.track(appLabel, avo, event)) {
            is AvoResult.Success ->
                appendLogLine("sent '${event.eventName}' to ${result.value}")
            is AvoResult.Failure ->
                appendLogLine("VERIFICATION FAILED: ${result.error.messages}")
        }
    }

    private fun formatEntry(entry: DummyAnalyticsDestination.LoggedEvent) =
        "[${entry.appLabel} → ${entry.destinationKey}] ${entry.eventName} ${entry.properties}"

    private fun appendLogLine(line: String) {
        logView.text = if (logView.text == EMPTY_LOG) line else "$line\n${logView.text}"
    }

    private fun sectionTitle(text: String) = TextView(this).apply {
        this.text = text
        textSize = 16f
        setTypeface(null, Typeface.BOLD)
        gravity = Gravity.START
        setPadding(0, 24, 0, 8)
    }

    private fun trackButton(label: String, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener { onClick() }
    }
}
