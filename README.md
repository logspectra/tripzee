# Tripzee — Smart Travel & Social Map Platform

Tripzee helps travellers discover destinations, explore an interactive map, plan day-by-day trips with
transparent budgets, find nearby services, and coordinate group trips with consent-based live location.
The first catalogue covers **Uttar Pradesh, India** (28 curated destinations across 12 cities), and the data
model is ready for other states and countries.

| Layer | Technology |
|---|---|
| Backend | Java 17, Spring Boot 3.5 (Web, Data JPA, Security, Validation, WebSocket/STOMP), Flyway |
| Database | H2 (file, PostgreSQL mode) for local dev · **PostgreSQL** for production — same migrations |
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS 4, React Router, Leaflet/react-leaflet, STOMP.js |
| Maps & places | OpenStreetMap tiles, Nominatim (search), Overpass (nearby, with Nominatim fallback), OSRM (routing) — **no API keys needed** |
| AI (optional) | Any OpenAI-compatible chat-completions API, called only from the backend |

---

## Quick start (local)

Prerequisites: **Java 17+**, **Maven 3.9+**, **Node 20+** (tested with Node 24).

```bash
# 1. Backend (http://localhost:8085)
cd backend
cp .env.example .env          # optional — sensible defaults work without it
./dev.sh                      # = mvn spring-boot:run
#   Behind a TLS-inspecting corporate proxy on macOS (PKIX errors in the log), use:
#   TRUST_MACOS_KEYCHAIN=1 ./dev.sh

# 2. Frontend (http://localhost:5173) — in a second terminal
cd web
npm install
npm run dev
```

Open **http://localhost:5173**. On first start the backend:

- runs the Flyway migrations (creates `backend/data/tripzee.mv.db`),
- seeds categories, the destination catalogue and an **admin account** (`admin@tripzee.local` /
  `ChangeMe-Admin123` by default — change `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`),
- fetches lead photos and coordinates from Wikipedia in the background (rate-limited, retried every 6 h).

To reset local data: stop the backend and delete `backend/data/`.

## Configuration

All settings are environment variables (or `backend/.env`, loaded automatically). See `backend/.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8085` | HTTP port |
| `DATABASE_URL` / `DATABASE_USER` / `DATABASE_PASSWORD` | H2 file DB | Use `jdbc:postgresql://host:5432/tripzee` in production |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | demo values | Seeded admin (created once if the email doesn't exist) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8085` | CORS + WebSocket origin allow-list |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | empty / OpenAI / `gpt-4o-mini` | Enables AI planner + assistant. Empty = rule-based fallbacks |
| `OSM_USER_AGENT` | `Tripzee/0.1 (local development)` | **Set a real contact** — required by Nominatim's usage policy |
| `NOMINATIM_URL`, `OSRM_URL`, `OVERPASS_URLS` | public servers | Point to self-hosted instances for production traffic |
| `EXTERNAL_LOOKUPS` | `true` | `false` disables all outbound map/wiki calls (offline dev) |
| `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION` (frontend) | OSM standard tiles | Swap in MapTiler/Mapbox/etc. tiles |

No secret is ever sent to the browser; the frontend only learns *whether* AI is enabled (`GET /api/meta`).

## Tests

```bash
cd backend && mvn test     # 19 tests: budget maths, planner rules, assistant intents, and API integration
cd web && npm test         # budget recompute + date/distance helpers
cd web && npm run typecheck
```

The API integration test (`ApiIntegrationTest`) covers: auth and the CSRF header, guest planning vs.
authenticated saving, trip privacy (other users get 404) and share links that hide expenses, one review per
user and duplicate-report prevention, **Travel Room location consent** (rejected without opt-in, deleted on
opt-out, not visible to non-members), and admin-only endpoints.

## Production deployment

**Single jar** (frontend bundled into Spring Boot):

```bash
./package.sh
java -jar backend/target/tripzee-backend-0.1.0-SNAPSHOT.jar
```

**Docker + PostgreSQL:**

```bash
ADMIN_PASSWORD='a-strong-password' POSTGRES_PASSWORD='another-one' docker compose up --build
```

Checklist for a public deployment:
- Serve over HTTPS and set `COOKIE_SECURE=true` and `ALLOWED_ORIGINS=https://your-domain`.
- Change the admin password, set `OSM_USER_AGENT` with real contact details.
- Public OSM services (Nominatim/Overpass/OSRM/tiles) are for light use only. For real traffic, self-host
  them or use a commercial provider (all URLs are configurable).
- Sessions are in-memory (single instance). For multiple replicas add Spring Session (JDBC/Redis), a shared
  STOMP broker relay, and move the in-memory rate limiter to Redis.

Any JVM host works (Render, Railway, Fly.io, AWS Elastic Beanstalk/ECS, a VM). The Flyway migrations are
written in portable SQL, so the same schema runs on PostgreSQL.

## Features and where they live

| Feature | Frontend | Backend |
|---|---|---|
| Destination discovery, filters, pagination | `pages/Destinations.tsx`, `pages/Home.tsx` | `destination/` |
| Destination details (history, facts with verification status, sources, nearby, TTS narration) | `pages/DestinationPage.tsx` | `destination/`, `places/WikiService` |
| Interactive map: search, current location (on request), nearby places, driving/walking directions | `pages/MapExplorer.tsx` | `places/OsmService` |
| Trip planner (AI or rule-based), save, regenerate, edit, share | `pages/Planner.tsx`, `pages/TripPage.tsx` | `trip/PlannerService`, `trip/TripService` |
| Budget estimate, planned vs actual, expenses | `components/BudgetPanel.tsx` | `trip/BudgetEstimator` |
| Hotels, restaurants, hospitals, pharmacies, ATMs, fuel, transport, parking | `pages/Services.tsx` | `places/OsmService` |
| Travel Room: invites, chat, trip updates, meeting points, consent-based live location | `pages/Rooms.tsx`, `pages/RoomPage.tsx` | `room/`, `config/WebSocketConfig` |
| Reviews, tips, sorting/filtering, reporting | `components/ReviewSection.tsx`, `pages/Community.tsx` | `review/` |
| English/Hindi UI and assistant, audio narration | `lib/i18n.tsx`, `pages/Assistant.tsx`, `lib/speech.ts` | `assistant/` |
| Saved places, dashboard, notifications, offline itineraries | `pages/Dashboard.tsx`, `lib/offline.ts`, `public/sw.js` | `me/` |
| Admin: stats, destination editor + fact verification + sources, moderation, users | `pages/Admin.tsx` | `admin/` |

## API overview

All endpoints are under `/api`. State-changing requests require the header `X-Tripzee: 1` (CSRF defence) and
the `TZSESSION` cookie set by login.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET/PATCH /auth/me` |
| Catalogue | `GET /destinations?q&city&category&interest&sort&page&pageSize`, `GET /destinations/{slug}`, `GET /destinations/cities`, `GET /destinations/near?lat&lng&radiusKm`, `GET /categories`, `GET /meta` |
| Maps | `GET /search?q`, `GET /geocode?q`, `GET /places/types`, `GET /places/nearby?lat&lng&type&radius`, `GET /route?fromLat&fromLng&toLat&toLng&mode` |
| Trips | `POST /trips/plan` (guest OK), `POST /trips`, `GET /trips`, `GET/PATCH/DELETE /trips/{id}`, `PUT /trips/{id}/items`, `POST /trips/{id}/regenerate`, `POST/DELETE /trips/{id}/share`, `GET /shared/{token}` |
| Budget | `PUT /trips/{id}/budget`, `POST /trips/{id}/expenses`, `DELETE /trips/{id}/expenses/{expenseId}` |
| Reviews | `GET/POST /destinations/{slug}/reviews`, `PATCH/DELETE /reviews/{id}`, `GET /reviews` (community), `POST /reports` |
| Rooms | `GET/POST /rooms`, `POST /rooms/join`, `GET/DELETE /rooms/{id}`, `POST /rooms/{id}/leave`, `DELETE /rooms/{id}/members/{userId}`, `POST /rooms/{id}/invite/rotate`, `PUT /rooms/{id}/trip`, `POST /rooms/{id}/messages`, `POST /rooms/{id}/sharing`, `POST /rooms/{id}/location`, `POST/DELETE /rooms/{id}/meeting-points[/{pointId}]` |
| Real time | STOMP over WebSocket at `/ws`; subscribe to `/topic/rooms/{id}` (members only). Writes always go through REST. |
| Me | `GET /me/dashboard`, `GET/POST /saved`, `DELETE /saved/{id}`, `GET /notifications`, `POST /notifications/read` |
| Assistant | `POST /assistant` `{message, locale, history}` |
| Admin | `GET /admin/stats`, `GET/PATCH /admin/users[/{id}]`, `GET/POST /admin/destinations`, `GET/PATCH /admin/destinations/{id}`, `POST /admin/destinations/{id}/verify`, `POST/DELETE /admin/destinations/{id}/sources[/{sourceId}]`, `POST /admin/destinations/{id}/enrich`, `GET/PATCH /admin/reports[/{id}]`, `GET/PATCH /admin/reviews[/{id}]` |

## Trustworthy data — design rules

- **No invented facts.** Opening hours, fees, accessibility and official links are `null` unless known. The UI
  shows "Not verified yet — check the official source". Every destination starts `factsVerified=false`;
  admins can mark facts verified only after adding at least one source, and editing a fact clears the flag.
- **Seed catalogue is editorial demo content.** It's labelled as such in the UI. Descriptions summarise widely
  documented history; coordinates and photos come from Wikipedia/Wikimedia (credited on each page).
- **Ratings are Tripzee-only.** No scraped or fake reviews. OSM "stars" are labelled as OSM data.
- **No fake bookings.** Tripzee links to official sites and shows OSM contact details; it never claims to book.
- **Estimates show their working.** Each budget line carries its basis (e.g. "₹3000/room/night × 1 room ×
  2 nights"); ticket costs are explicit placeholders until fees are verified.
- **AI is grounded and labelled.** The LLM may only use catalogue attractions (validated server-side), costs
  always come from the deterministic estimator, and the UI says whether an answer is AI or rule-based.

## Privacy & security

- Session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production), BCrypt (cost 12) password hashing,
  session-fixation protection, per-request user refresh (suspensions/role changes apply immediately).
- CSRF: custom-header requirement on all writes plus a strict CORS/WebSocket origin allow-list.
- Rate limits on login/registration and on the (potentially paid) planner and assistant endpoints.
- Bean Validation on every request body; parameterised JPA queries; CSP, `X-Frame-Options: DENY`, `nosniff`.
- Location: accepted only while a member has opted in; only the latest point is stored; deleted immediately
  on opt-out, leaving or removal; hidden after 30 min and purged after 2 h; pushed only to room subscribers
  whose membership is checked on subscribe. The browser's own permission prompt is a second consent layer.
- Offline itinerary copies are stored in `localStorage` and cleared on sign-out.

## Known limitations

- **AI needs a key.** Without `LLM_API_KEY` the planner and assistant use transparent rule-based logic. With a
  key, quality depends on the model; outputs are validated but may still contain mistakes (labelled in the UI).
- **Public OSM services are best-effort.** Overpass is often overloaded; Tripzee falls back to Nominatim and
  caches results for 24 h, but coverage of phone numbers, hours, price ranges and ratings is limited to what
  OpenStreetMap contributors have mapped. Routing excludes live traffic.
- **Hindi.** UI chrome, destination names/summaries and assistant templates are in Hindi; long-form
  descriptions are English-only for now (the UI says so). Hindi speech depends on the device having a Hindi voice.
- **Live location** updates only while the Travel Room page is open (browsers restrict background location for web apps).
- **Offline** support covers itineraries you have opened; maps, search and live data need a connection.
- **Scale.** Single-instance design (in-memory sessions, simple broker, in-memory rate limits) — see the
  deployment checklist for multi-instance changes. Destination search filters in memory (fine for hundreds of places).
- The PostgreSQL path (Dockerfile/compose) uses the same Flyway migrations validated on H2's PostgreSQL mode,
  but it wasn't run against a live PostgreSQL in this environment.
