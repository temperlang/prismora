// Runs the tour with `./gradlew run`, compiling the Java that
// `temper build -b java` generates at the repo's top along with it.

plugins {
    application
}

val temperOut = file("../../../temper.out/java")

sourceSets {
    main {
        java {
            for (library in listOf("temper-core", "std", "prismora")) {
                srcDir(temperOut.resolve("$library/src/main/java"))
            }
        }
    }
}

tasks.withType<JavaCompile> {
    options.compilerArgs.add("-nowarn")
}

application {
    mainClass = "Tour"
}
