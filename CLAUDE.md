# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frontend-only Angular application for browsing D&D dungeons with creatures, items, and nested containers. Connects directly to TypeDB via TypeScript HTTP Driver.

## Architecture

### Frontend (Angular)
- **Framework**: Angular 21 with standalone components
- **Language**: TypeScript 5.9
- **Testing**: Vitest 4.x (not Karma/Jasmine)
- **Structure**:
  - Standalone component architecture (no NgModules)
  - Uses signals for state management (`signal()`)
  - Router-based navigation with `RouterOutlet`
  - Direct TypeDB connection via TypeScript HTTP Driver

### Database Connection
- **Database**: TypeDB 3.7.0
- **Driver**: `@typedb/driver-http` - TypeDB TypeScript HTTP Driver
- **Connection**: Configurable via Settings UI (TypeDB Cloud or local instance)
- **Schema**: `data/schema.ttql` - TypeQL schema modelling dungeons, rooms, creatures, items, and containers

### Data

- TypeDB 3.7.0 database
- `data/schema.ttql`: TypeQL schema modelling dungeons, characters, and items
- `data/example.ttql`: Example query to insert data about a dungeon containing a monster and a number of items

## Development Commands

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

### Frontend
- Angular 21 standalone components (no NgModules)
- Signals-based reactivity pattern for state management
- TypeDB TypeScript HTTP Driver for direct database access
- User-configurable TypeDB connection via Settings page
- Vitest for unit testing (not Jest or Karma)
- Prettier configured with 100 char line width and single quotes
- Package manager locked to npm@10.9.2

### TypeDB Integration
- **Services**:
  - `TypeDBConnectionService`: Manages connection lifecycle and transaction execution
  - `TypeDBQueryService`: Encapsulates all TypeQL queries for dungeons, rooms, creatures, items
  - `DungeonService`: Bridges UI components with TypeDB queries
- **Components**:
  - `TypeDBSettingsComponent`: UI for configuring TypeDB connection credentials
  - `DungeonViewer`: Main UI for browsing dungeon contents with filters
  - `CreatureStatblock`: Displays D&D 5e creature statistics
- **Connection Guard**: Redirects to Settings if not connected to TypeDB
- **Queries**: Complex recursive queries for nested container structures

### Security Notes
- Credentials entered at runtime via Settings UI
- Connection preferences (except password) stored in localStorage
- Password must be re-entered each session
- TLS enabled by default for TypeDB Cloud connections

## Testing
- Frontend: Vitest with jsdom (no e2e tests configured yet)
- Manual testing scenarios: connection management, query execution, persistence

## Code Organization
- Frontend: Standard Angular CLI structure with `src/app/` for components
- Services: `src/app/services/` - TypeDB connection and query logic
- Components: `src/app/components/` - UI components
- Models: `src/app/models/` - TypeScript interfaces for D&D data
- Guards: `src/app/guards/` - Route protection (connection guard)
