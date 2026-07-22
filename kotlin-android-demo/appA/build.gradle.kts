// App A: a feature app whose analytics surface is generated from its own Avo
// source. Only the source-specific file (avo/Avo.kt) lives here — the runtime
// comes from :library. `api` so the shell (:app) sees the shared runtime types.
plugins {
    id("com.android.library")
}

android {
    namespace = "com.avodemo.appa"
    compileSdk = 36

    defaultConfig {
        minSdk = 21
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    api(project(":library"))

    testImplementation("org.jetbrains.kotlin:kotlin-test:2.2.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
}
