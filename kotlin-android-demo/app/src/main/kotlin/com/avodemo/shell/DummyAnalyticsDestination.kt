package com.avodemo.shell

// Example destination implementation. In a real shell you would replace this
// with actual analytics SDK clients (Segment, Amplitude, Mixpanel, ...) — one
// `logEvent` call per destination key returned by `avo.process(event)`.
//
// This dummy just records every call so the demo UI and the tests can assert
// on the exact fan-out: which app produced the event, which destination key it
// was routed to, and what the (name-mapped) payload looked like.
class DummyAnalyticsDestination {

    data class LoggedEvent(
        val appLabel: String,
        val destinationKey: String,
        val eventName: String,
        val properties: Map<String, Any>,
    )

    private val _entries = mutableListOf<LoggedEvent>()
    val entries: List<LoggedEvent> get() = synchronized(_entries) { _entries.toList() }

    var onLog: ((LoggedEvent) -> Unit)? = null

    fun logEvent(appLabel: String, destinationKey: String, eventName: String, properties: Map<String, Any>) {
        val entry = LoggedEvent(appLabel, destinationKey, eventName, properties)
        synchronized(_entries) { _entries.add(entry) }
        onLog?.invoke(entry)
    }

    fun clear() = synchronized(_entries) { _entries.clear() }
}
