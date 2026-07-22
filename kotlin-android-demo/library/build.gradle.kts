// The :library module holds the Avo runtime (AvoLibraryInterface.kt) — the
// source-agnostic half of the library-interface codegen split. It is identical
// for every Avo source generated with the same Avo SDK version, so a real
// codebase can publish this module once and share it across all apps.
plugins {
    id("com.android.library")
}

android {
    namespace = "sh.avo.library"
    compileSdk = 36

    defaultConfig {
        minSdk = 21
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
}
