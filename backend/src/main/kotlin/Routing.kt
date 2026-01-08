package com.sambutcher

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    // Read TypeDB configuration
    val typeDBAddress = environment.config.propertyOrNull("typedb.address")?.getString() ?: "localhost:1729"
    val typeDBDatabase = environment.config.propertyOrNull("typedb.database")?.getString() ?: "dnd"

    // Initialize TypeDB service
    val typeDBService = TypeDBService(typeDBAddress, typeDBDatabase)

    // Connect to TypeDB on startup
    try {
        typeDBService.connect()
    } catch (e: Exception) {
        log.error("Failed to connect to TypeDB on startup", e)
    }

    // Close connection on shutdown
    monitor.subscribe(ApplicationStopping) {
        typeDBService.close()
    }

    routing {
        get("/") {
            call.respondText("Hello World!")
        }

        get("/api/dungeons/{name}") {
            val dungeonName = call.parameters["name"] ?: run {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Dungeon name is required"))
                return@get
            }

            val dungeonGraph = typeDBService.getDungeonGraph(dungeonName)

            if (dungeonGraph != null) {
                call.respond(dungeonGraph)
            } else {
                call.respond(
                    HttpStatusCode.NotFound,
                    mapOf("error" to "Dungeon '$dungeonName' not found")
                )
            }
        }
    }
}
