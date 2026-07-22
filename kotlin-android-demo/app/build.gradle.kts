// The shell: an installable Android app hosting both feature apps. It owns
// analytics initialization (one Avo instance per app source) and the shared
// destination fan-out.
plugins {
    id("com.android.application")
}

android {
    namespace = "com.avodemo.shell"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.avodemo.shell"
        minSdk = 21
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
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
    implementation(project(":appA"))
    implementation(project(":appB"))

    testImplementation("org.jetbrains.kotlin:kotlin-test:2.2.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
}
