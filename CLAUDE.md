# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack application with a Kotlin/Ktor backend and Angular frontend. The project appears to be in early stages with basic scaffolding in place.

## Architecture

### Backend (Kotlin/Ktor)
- **Framework**: Ktor 3.3.2 with Netty server
- **Language**: Kotlin 2.2.21
- **Package**: `com.sambutcher`
- **Entry Point**: `Application.kt` - uses `EngineMain` pattern
- **Configuration**: YAML-based (`application.yaml`) with deployment port 8080
- **Structure**:
  - `Application.kt`: Main entry point, loads modules
  - `Routing.kt`: HTTP route definitions
  - Configuration loaded from `backend/src/main/resources/application.yaml`

### Frontend (Angular)
- **Framework**: Angular 21 (latest) with standalone components
- **Language**: TypeScript 5.9
- **Testing**: Vitest 4.x (not Karma/Jasmine)
- **Structure**:
  - Standalone component architecture (no NgModules)
  - Uses signals for state management (`signal()`)
  - Router-based navigation with `RouterOutlet`

### Data
- `data/schema.ttql`: Empty schema file (TypeQL schema, as yet unwritten)

## Development Commands

### Backend (from `backend/` directory)
```bash
# Run tests
mvn test

# Build the project (creates jar-with-dependencies)
mvn package

# Run the server
java -jar target/somerandomdndnotething-0.0.1-jar-with-dependencies.jar

# Alternative: Run directly with Maven
mvn exec:java
```

Expected output when server starts:
```
Application started in 0.303 seconds.
Responding at http://0.0.0.0:8080
```

### Frontend (from `frontend/` directory)
```bash
# Start development server (http://localhost:4200)
npm start
# or
ng serve

# Build for production
npm run build
# or
ng build

# Run unit tests (Vitest)
npm test
# or
ng test

# Watch mode for development
npm run watch
```

## Key Technical Details

### Backend
- JWT authentication configured with placeholder values (domain: `https://jwt-provider-domain/`, audience: `jwt-audience`)
- Secret stored in code (should be moved to config/environment variables for production)
- HMAC256 algorithm for JWT validation
- All Kotlin source in `backend/src/main/kotlin/` (no package subdirectories currently)

### Frontend
- Angular 21 standalone components (no NgModules)
- Signals-based reactivity pattern
- Vitest for unit testing (not Jest or Karma)
- Prettier configured with 100 char line width and single quotes
- Package manager locked to npm@10.9.2

## Testing
- Backend: JUnit tests with Ktor's test-host
- Frontend: Vitest with jsdom (no e2e tests configured yet)

## Code Organization
- Backend: Flat structure in `com.sambutcher` package, uses Ktor's extension function pattern (`Application.configure*()`)
- Frontend: Standard Angular CLI structure with `src/app/` for components
