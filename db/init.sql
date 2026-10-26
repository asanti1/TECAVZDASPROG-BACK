CREATE TABLE branches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT             NOT NULL,
    latitude    DOUBLE PRECISION NOT NULL CHECK (latitude  BETWEEN  -90 AND  90),
    longitude   DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180)
);

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role           TEXT        NOT NULL CHECK (role IN ('CUSTOMER', 'DELIVERY_PERSON', 'ADMIN')),
    name           TEXT        NOT NULL,
    email          TEXT        NOT NULL UNIQUE,
    password_hash  TEXT        NOT NULL,
    branch_id      UUID        REFERENCES branches (id),
    registered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_branch_by_role CHECK (
        (role = 'CUSTOMER' AND branch_id IS NULL)
        OR (role IN ('DELIVERY_PERSON', 'ADMIN') AND branch_id IS NOT NULL)
    )
);

CREATE TABLE vehicles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_person_id  UUID             NOT NULL UNIQUE REFERENCES users (id),
    license_plate       TEXT             NOT NULL UNIQUE,
    avg_speed           DOUBLE PRECISION NOT NULL CHECK (avg_speed > 0)
);

CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID    NOT NULL REFERENCES branches (id),
    name        TEXT    NOT NULL,
    sku         TEXT    NOT NULL,
    stock_qty   INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    UNIQUE (branch_id, sku)
);

CREATE TABLE trips (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_person_id  UUID        NOT NULL REFERENCES users (id),
    status              TEXT        NOT NULL DEFAULT 'planned'
                                    CHECK (status IN ('planned', 'in_progress', 'completed')),
    departure_at        TIMESTAMPTZ
);

CREATE TABLE orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                  TEXT        NOT NULL CHECK (type IN ('CUSTOMER', 'INTER_BRANCH')),
    status                TEXT        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'assigned', 'in_trip', 'delivered')),
    origin_branch_id      UUID        NOT NULL REFERENCES branches (id),
    destination_branch_id UUID        REFERENCES branches (id),
    customer_id           UUID        REFERENCES users (id),
    delivery_address      JSONB,
    trip_id               UUID        REFERENCES trips (id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT orders_target_by_type CHECK (
        (type = 'CUSTOMER'
            AND customer_id IS NOT NULL
            AND delivery_address IS NOT NULL
            AND destination_branch_id IS NULL)
        OR
        (type = 'INTER_BRANCH'
            AND destination_branch_id IS NOT NULL
            AND destination_branch_id <> origin_branch_id
            AND customer_id IS NULL)
    ),
    CONSTRAINT orders_trip_by_status CHECK (
        (status = 'pending' AND trip_id IS NULL)
        OR (status <> 'pending' AND trip_id IS NOT NULL)
    )
);

CREATE TABLE order_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id  UUID    NOT NULL REFERENCES products (id),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    UNIQUE (order_id, product_id)
);

CREATE TABLE routes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             UUID             NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    sequence_order      INTEGER          NOT NULL CHECK (sequence_order >= 1),
    geometry            JSONB            NOT NULL,
    distance_km         DOUBLE PRECISION NOT NULL CHECK (distance_km >= 0),
    estimated_time_min  INTEGER          NOT NULL CHECK (estimated_time_min >= 0),
    algorithm_used      TEXT             NOT NULL,
    UNIQUE (trip_id, sequence_order)
);

CREATE INDEX idx_orders_status_origin ON orders (status, origin_branch_id);
CREATE INDEX idx_orders_trip          ON orders (trip_id);
CREATE INDEX idx_trips_delivery       ON trips  (delivery_person_id);
CREATE INDEX idx_products_branch      ON products (branch_id);
