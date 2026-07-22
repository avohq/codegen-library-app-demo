// App B: second feature app, generated from a different Avo source than App A.
// Same layout principle: only the source-specific file lives here.
plugins {
    id("com.android.library")
}

android {
    namespace = "com.avodemo.appb"
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
