package com.sambutcher

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Application.configureRouting() {
    // Read TypeDB configuration
    val typeDBAddress = environment.config.propertyOrNull("typedb.address")?.getString() ?: "localhost:1729"
    val typeDBDatabase = environment.config.propertyOrNull("typedb.database")?.getString() ?: "dnd"
    val typeDBUsername = environment.config.propertyOrNull("typedb.username")?.getString() ?: "admin"
    val typeDBPassword = environment.config.propertyOrNull("typedb.password")?.getString() ?: "password"
    val typeDBTLSEnabled = environment.config.propertyOrNull("typedb.tlsEnabled")?.getString()?.lowercase().equals("true")

    // Initialize TypeDB service
    val typeDBService = TypeDBService(typeDBAddress, typeDBDatabase, typeDBUsername, typeDBPassword, typeDBTLSEnabled)

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
