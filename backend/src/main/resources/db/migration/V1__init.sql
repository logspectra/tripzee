-- Tripzee schema. Written in portable SQL that runs on PostgreSQL and on H2 (PostgreSQL mode).
-- Enum-like columns are VARCHARs validated in the API layer.

CREATE TABLE users (
    id            VARCHAR(36) PRIMARY KEY,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    name          VARCHAR(80)  NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'USER',
    status        VARCHAR(12)  NOT NULL DEFAULT 'ACTIVE',
    locale        VARCHAR(5)   NOT NULL DEFAULT 'en',
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE categories (
    id      VARCHAR(36) PRIMARY KEY,
    slug    VARCHAR(40) NOT NULL UNIQUE,
    name    VARCHAR(80) NOT NULL,
    name_hi VARCHAR(80) NOT NULL
);

CREATE TABLE destinations (
    id                    VARCHAR(36) PRIMARY KEY,
    slug                  VARCHAR(120) NOT NULL UNIQUE,
    name                  VARCHAR(160) NOT NULL,
    name_hi               VARCHAR(160),
    city                  VARCHAR(80)  NOT NULL,
    state                 VARCHAR(80)  NOT NULL,
    country               VARCHAR(80)  NOT NULL,
    category_id           VARCHAR(36)  NOT NULL REFERENCES categories (id),
    lat                   DOUBLE PRECISION NOT NULL,
    lng                   DOUBLE PRECISION NOT NULL,
    coords_source         VARCHAR(80),
    summary               VARCHAR(1000) NOT NULL,
    summary_hi            VARCHAR(1000),
    description           VARCHAR(8000) NOT NULL,
    history               VARCHAR(8000),
    cultural_significance VARCHAR(8000),
    interests             VARCHAR(300) NOT NULL DEFAULT '',
    opening_hours         VARCHAR(500),
    entry_fee             VARCHAR(500),
    visit_minutes         INTEGER NOT NULL DEFAULT 120,
    best_time_to_visit    VARCHAR(500),
    accessibility         VARCHAR(1000),
    guidelines            VARCHAR(2000),
    official_url          VARCHAR(500),
    ticket_url            VARCHAR(500),
    facts_verified        BOOLEAN NOT NULL DEFAULT FALSE,
    last_verified_at      TIMESTAMP WITH TIME ZONE,
    wiki_title            VARCHAR(200),
    image_url             VARCHAR(1000),
    image_credit          VARCHAR(300),
    published             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_destinations_city ON destinations (city);
CREATE INDEX idx_destinations_geo ON destinations (lat, lng);

CREATE TABLE source_references (
    id             VARCHAR(36) PRIMARY KEY,
    destination_id VARCHAR(36)  NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
    label          VARCHAR(200) NOT NULL,
    url            VARCHAR(1000) NOT NULL,
    field          VARCHAR(60),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_sources_destination ON source_references (destination_id);

CREATE TABLE trips (
    id           VARCHAR(36) PRIMARY KEY,
    owner_id     VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        VARCHAR(160) NOT NULL,
    origin       VARCHAR(160) NOT NULL,
    origin_lat   DOUBLE PRECISION,
    origin_lng   DOUBLE PRECISION,
    city         VARCHAR(80)  NOT NULL,
    start_date   DATE         NOT NULL,
    end_date     DATE         NOT NULL,
    travellers   INTEGER      NOT NULL,
    budget       INTEGER      NOT NULL,
    interests    VARCHAR(300) NOT NULL DEFAULT '',
    transport    VARCHAR(12)  NOT NULL,
    pace         VARCHAR(12)  NOT NULL,
    generated_by VARCHAR(12)  NOT NULL DEFAULT 'rules',
    notes        VARCHAR(4000),
    share_token  VARCHAR(40) UNIQUE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_trips_owner ON trips (owner_id);

CREATE TABLE itinerary_items (
    id             VARCHAR(36) PRIMARY KEY,
    trip_id        VARCHAR(36)  NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    day_number     INTEGER      NOT NULL,
    sort_order     INTEGER      NOT NULL,
    start_time     VARCHAR(5),
    end_time       VARCHAR(5),
    title          VARCHAR(200) NOT NULL,
    kind           VARCHAR(12)  NOT NULL,
    destination_id VARCHAR(36) REFERENCES destinations (id) ON DELETE SET NULL,
    lat            DOUBLE PRECISION,
    lng            DOUBLE PRECISION,
    notes          VARCHAR(2000),
    est_cost       INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX idx_items_trip ON itinerary_items (trip_id, day_number, sort_order);

CREATE TABLE budget_categories (
    id       VARCHAR(36) PRIMARY KEY,
    trip_id  VARCHAR(36) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL,
    planned  INTEGER     NOT NULL,
    basis    VARCHAR(1000) NOT NULL,
    CONSTRAINT uq_budget_trip_category UNIQUE (trip_id, category)
);

CREATE TABLE expenses (
    id         VARCHAR(36) PRIMARY KEY,
    trip_id    VARCHAR(36) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id    VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category   VARCHAR(20) NOT NULL,
    amount     INTEGER     NOT NULL,
    note       VARCHAR(300),
    spent_on   DATE        NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_expenses_trip ON expenses (trip_id);

CREATE TABLE saved_places (
    id             VARCHAR(36) PRIMARY KEY,
    user_id        VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    destination_id VARCHAR(36) REFERENCES destinations (id) ON DELETE CASCADE,
    external_ref   VARCHAR(120),
    name           VARCHAR(200) NOT NULL,
    kind           VARCHAR(30),
    lat            DOUBLE PRECISION,
    lng            DOUBLE PRECISION,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_saved_destination UNIQUE (user_id, destination_id),
    CONSTRAINT uq_saved_external UNIQUE (user_id, external_ref)
);

CREATE TABLE reviews (
    id             VARCHAR(36) PRIMARY KEY,
    user_id        VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    destination_id VARCHAR(36)  NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
    rating         INTEGER      NOT NULL,
    title          VARCHAR(120) NOT NULL,
    body           VARCHAR(4000) NOT NULL,
    tip            VARCHAR(1000),
    visited_on     DATE,
    status         VARCHAR(10)  NOT NULL DEFAULT 'VISIBLE',
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_review_user_destination UNIQUE (user_id, destination_id),
    CONSTRAINT ck_review_rating CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX idx_reviews_destination ON reviews (destination_id, status);

CREATE TABLE reports (
    id             VARCHAR(36) PRIMARY KEY,
    reporter_id    VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_type    VARCHAR(20) NOT NULL,
    target_id      VARCHAR(36) NOT NULL,
    reason         VARCHAR(20) NOT NULL,
    details        VARCHAR(1000),
    status         VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    resolved_by_id VARCHAR(36),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_report_once UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX idx_reports_status ON reports (status);

CREATE TABLE travel_rooms (
    id          VARCHAR(36) PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    invite_code VARCHAR(12)  NOT NULL UNIQUE,
    owner_id    VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    trip_id     VARCHAR(36) REFERENCES trips (id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE room_members (
    id               VARCHAR(36) PRIMARY KEY,
    room_id          VARCHAR(36) NOT NULL REFERENCES travel_rooms (id) ON DELETE CASCADE,
    user_id          VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role             VARCHAR(10) NOT NULL DEFAULT 'MEMBER',
    sharing_location BOOLEAN     NOT NULL DEFAULT FALSE,
    consent_at       TIMESTAMP WITH TIME ZONE,
    joined_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

CREATE TABLE room_messages (
    id         VARCHAR(36) PRIMARY KEY,
    room_id    VARCHAR(36) NOT NULL REFERENCES travel_rooms (id) ON DELETE CASCADE,
    user_id    VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body       VARCHAR(2000) NOT NULL,
    kind       VARCHAR(10) NOT NULL DEFAULT 'message',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_messages_room ON room_messages (room_id, created_at);

CREATE TABLE meeting_points (
    id            VARCHAR(36) PRIMARY KEY,
    room_id       VARCHAR(36)  NOT NULL REFERENCES travel_rooms (id) ON DELETE CASCADE,
    created_by_id VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name          VARCHAR(120) NOT NULL,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    meet_at       TIMESTAMP WITH TIME ZONE,
    note          VARCHAR(500),
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Only the latest position per member is kept; deleted as soon as sharing stops.
CREATE TABLE location_updates (
    id         VARCHAR(36) PRIMARY KEY,
    room_id    VARCHAR(36) NOT NULL REFERENCES travel_rooms (id) ON DELETE CASCADE,
    user_id    VARCHAR(36) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    accuracy   DOUBLE PRECISION,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_location_member UNIQUE (room_id, user_id)
);

CREATE TABLE notifications (
    id         VARCHAR(36) PRIMARY KEY,
    user_id    VARCHAR(36)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       VARCHAR(30)  NOT NULL,
    message    VARCHAR(500) NOT NULL,
    link       VARCHAR(300),
    is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read);

CREATE TABLE external_cache (
    cache_key  VARCHAR(300) PRIMARY KEY,
    payload    VARCHAR(1000000) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL
);
