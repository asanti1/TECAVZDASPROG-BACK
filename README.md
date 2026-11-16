# Plataforma de Logística y Rutas de Entrega

Trabajo práctico de *Técnicas Avanzadas de Programación*. Sistema para una red de
sucursales que recibe pedidos, elige desde qué sucursal despacharlos, arma viajes de
reparto y calcula el recorrido por las calles reales.

## Qué hace

1. Se crea un **pedido** (a un cliente o entre sucursales). El sistema elige la sucursal
   más cercana que tiene stock completo y lo descuenta en la misma transacción.
2. Se arma un **viaje** con varios pedidos de una misma sucursal y un repartidor.
3. El backend le pide las **rutas** a un servicio independiente por RabbitMQ. El servicio
   descarga las calles de OpenStreetMap, ordena las paradas y calcula cada tramo.
4. El resultado vuelve por RabbitMQ, se guarda y el viaje puede **salir** y **completarse**.
5. Mientras el viaje está en curso, el repartidor informa su posición por **WebSocket** y quien
   siga el viaje la recibe en vivo.

## Arquitectura

```
 Frontend (estático) ──HTTP/JSON──▶ Backend NestJS ──SQL──▶ PostgreSQL
                                        │   ▲
                      route.requests    │   │  route.results
                                        ▼   │
                                      RabbitMQ
                                        │   ▲
                                        ▼   │
                               Servicio de rutas (Python)
                               OSMnx · Dijkstra / A*
```

| Pieza | Tecnología | Responsabilidad |
|---|---|---|
| `backend/` | TypeScript, NestJS | Dominio, casos de uso, API REST, persistencia |
| `routing-service/` | Python, OSMnx, pika | Cálculo de rutas sobre el mapa real |
| `bruno/` | Bruno | Colección de requests para probar la API a mano |
| `frontend/` | HTML + JS + Leaflet | Demo mínima de la API (no es parte de lo evaluado) |
| `db/` | PostgreSQL 16 | Esquema (`init.sql`) y datos de ejemplo (`seed.sql`) |
| `rabbitmq/` | RabbitMQ 3 | Usuarios, permisos, exchange y colas (`definitions.json`) |

El backend y el servicio de rutas son **procesos independientes** que solo comparten el
contrato de mensajes. El servicio de rutas no tiene acceso a la base de datos.

### Estructura del backend

Organizado por funcionalidad (`branches`, `orders`, `trips`, `tracking`, `users`, `shared`). Dentro de
cada una, las capas y la dirección de las dependencias:

```
api  ─▶  application  ─▶  domain  ◀─  infrastructure
```

- `domain`: reglas de negocio puras. No importa NestJS, `pg` ni nada de infraestructura.
- `application`: casos de uso (`OrdersService`, `TripsService`, `TripPlanner`).
- `infrastructure`: Postgres y RabbitMQ, detrás de interfaces definidas en el dominio.
- `api`: controladores, DTOs de validación y presentadores de respuesta.

Reglas de dependencia entre funcionalidades: `branches` no conoce a `orders` ni `trips`;
`orders` no conoce a `trips`; `trips` no conoce a `tracking`; `shared` no conoce a ninguna funcionalidad.

## Patrones y principios

| Qué | Dónde |
|---|---|
| **Inyección de dependencias** por interfaz y token (`@Inject(TOKEN)`) | `OrdersService` recibe 6 dependencias; los módulos enlazan token → implementación |
| **Strategy** | Elección de sucursal (`IBranchSelectionStrategy`), asignación de repartidor (`IDeliveryAssignmentStrategy`) y algoritmo de camino mínimo (`PathFinder`: Dijkstra o A\*) |
| **Repository** | `IOrderRepository`, `ITripRepository`, `IBranchRepository`, ... con implementación Postgres |
| **Unit of Work** | `IUnitOfWork` / `PostgresUnitOfWork`: transacciones que se anidan y se propagan solas |
| **Adapter** | `AmqpRouteOptimizer` traduce `IRouteOptimizer` a mensajes de RabbitMQ; `OsmnxMapSource` traduce OSMnx a nuestro grafo |
| **Máquina de estados** | `Order` (pending → assigned → in_trip → delivered) y `Trip` (planned → in_progress → completed) |
| **Idempotencia** | Un resultado de rutas repetido se ignora (backend) y un pedido repetido no se recalcula (servicio) |
| **SOLID** | Una responsabilidad por clase; el dominio depende de abstracciones, nunca de detalles |

Decisiones relevantes:

- **Comunicación asíncrona.** `POST /trips` responde enseguida con el viaje planificado y las
  rutas llegan después. Si el servicio de rutas está caído, el viaje queda guardado y se
  reintenta con `POST /trips/:id/request-routes`.
- **Stock concurrente.** El descuento es un `UPDATE ... WHERE stock_qty >= n`: nunca se
  vende más de lo que hay, sin bloqueos explícitos.
- **Mensajes inválidos.** Van a colas de descartes (`*.dead`) en lugar de reintentarse sin fin.
- **Mínimo privilegio en RabbitMQ.** `backend` solo publica pedidos y lee resultados;
  `router` solo lee pedidos y publica resultados. Ninguno puede crear colas.
- **Repartidores.** Cada uno pertenece a una sucursal. Al crear un viaje el sistema elige entre los libres de la sucursal de origen (sin viaje planificado ni en curso) al que menos viajes completó; si no hay ninguno, `409`. Un índice único parcial en la base impide dos viajes abiertos para el mismo repartidor, aun con pedidos simultáneos.
- **Autenticación mínima.** Login con JWT y tres roles (ver *Autenticación y roles*). Los guards son globales: una ruta nueva queda protegida por defecto y hay que marcarla `@Public()` para abrirla.
- **Orden de paradas.** Vecino más cercano mejorado con 2-opt (heurística); no garantiza el óptimo exacto del TSP.
- **Posición en vivo.** Se guarda solo la última, en memoria (dato efímero); no pasa por PostgreSQL.

## Requisitos

- Docker y Docker Compose
- Node.js 22+ y npm
- Python 3.13+

## Puesta en marcha

### Todo con un comando (Docker)

Solo hace falta Docker. Desde la raíz del repo:

```bash
docker compose up -d --build
```

Levanta PostgreSQL (con el esquema y los datos de ejemplo), RabbitMQ, el backend, el servicio de rutas y el frontend.

| Servicio | Dirección |
|---|---|
| Frontend de demostración | http://localhost:5173 |
| API del backend | http://localhost:3000 |
| Administración de RabbitMQ | http://localhost:15672 (usuario `logistics`, clave `logistics_dev`) |

La primera vez, el servicio de rutas descarga el mapa de calles de la zona (Bahía Blanca y alrededores) desde OpenStreetMap, lo guarda en un archivo del volumen y no vuelve a bajarlo (ver *Mapa de calles*). Para dejarlo listo antes de una presentación:

```bash
docker compose up -d --build
docker compose logs -f routing      # esperar "Mapa listo"
```

```bash
docker compose logs -f routing    # ver qué hace el servicio de rutas
docker compose down               # apagar (conserva los datos)
docker compose down -v            # apagar y borrar todo, incluidos datos y caché del mapa
```

Para ejecutar el algoritmo A\* en lugar de Dijkstra: `ROUTING_ALGORITHM=a_star docker compose up -d --build`.

### Desarrollo local (sin contenedores para el código)

Solo la infraestructura va en Docker; cada pieza corre en su terminal:

```bash
# 1. Base de datos y RabbitMQ
docker compose up -d postgres rabbitmq

# 2. Backend  (http://localhost:3000)
cd backend && npm install && JWT_SECRET=cualquier-cosa npm run start:dev

# 3. Servicio de rutas
cd routing-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.main

# 4. Frontend de demostración  (http://localhost:5173)
python3 -m http.server 5173 --directory frontend
```

No hay que correr las dos formas a la vez: usan los mismos puertos.

**Prueba de punta a punta** (crea pedidos, arma un viaje, espera las rutas, lo despacha y lo completa):

```bash
python3 scripts/smoke.py
```

En el frontend, entrar con `admin@demo.local` / `demo1234` (ve todo), `cliente@demo.local` (solo crea pedidos y ve los suyos) o `repartidor1@demo.local` (solo sus viajes).

Si cambia `db/init.sql`, `db/seed.sql` o `rabbitmq/definitions.json`, hay que recrear los volúmenes:
`docker compose down -v && docker compose up -d --build`.

## Mapa de calles

El servicio de rutas no descarga el mapa en cada viaje: baja **una zona fija** (por defecto ~26 x 26 km alrededor de Bahía Blanca) y la guarda en `cache/map.graphml`.

- Primera vez: descarga y guarda. Al reiniciar, carga el archivo en segundos, sin internet.
- Si el archivo tiene más de 15 días, se sigue usando y se intenta actualizar en segundo plano; si falla, queda el anterior.
- Un pedido con puntos fuera de la zona se rechaza (va a `route.requests.dead`).
- Forzar la descarga: `docker compose run --rm routing python -m app.download_map`
- Si el servidor público de OpenStreetMap no responde, usar otro con `OVERPASS_URL` (por ejemplo `https://maps.mail.ru/osm/tools/overpass/api`).

## API

| Método y ruta | Quién | Descripción |
|---|---|---|
| `POST /auth/login` | público | Entra con `{ email, password }`; devuelve `accessToken` y el usuario |
| `GET /branches` | autenticado | Sucursales |
| `GET /branches/:id/products` | autenticado | Stock de una sucursal |
| `GET /products` | autenticado | Productos con su stock por sucursal |
| `GET /users?role=CUSTOMER\|DELIVERY_PERSON` | admin | Usuarios por rol |
| `POST /orders` | cliente, admin | Crea un pedido (`CUSTOMER` o `INTER_BRANCH`) |
| `GET /orders` | cliente (los suyos), admin | Lista pedidos (filtros `status`, `branchId` = sucursal de origen) |
| `GET /orders/:id` | cliente (suyo), admin | Un pedido |
| `POST /trips` | admin | Crea un viaje con `orderIds` (todos de la misma sucursal): el sistema asigna un repartidor libre de esa sucursal y pide las rutas |
| `GET /trips` · `GET /trips/:id` | admin, repartidor (los suyos) | Viajes (con `routesReady` y los tramos cuando están) |
| `GET /trips/:id/route` | admin, repartidor (suyo) | Recorrido completo (tramos con geometría y totales) para dibujar en el mapa |
| `GET /trips/:id/location` | admin, repartidor (suyo) | Última posición conocida del repartidor |
| `POST /trips/:id/start` | admin, repartidor (suyo) | Sale el viaje (requiere rutas calculadas) |
| `POST /trips/:id/complete` | admin, repartidor (suyo) | Completa el viaje y entrega sus pedidos |
| `POST /trips/:id/request-routes` | admin | Reintenta el pedido de rutas (`202`) |

### Autenticación y roles

`POST /auth/login` devuelve un JWT (HS256, 8 horas) que se manda en cada pedido como `Authorization: Bearer <token>`. Sin token válido, `401`; con un rol que no corresponde, `403`. Las contraseñas se guardan con scrypt y sal propia (nunca en claro) y el mismo error responde si falla el mail o la clave.

| Rol | Puede |
|---|---|
| `CUSTOMER` | Crear pedidos (siempre a su nombre: el cliente sale del token) y ver los suyos |
| `DELIVERY_PERSON` | Ver, iniciar, completar y reportar la posición de **sus** viajes |
| `ADMIN` | Todo lo anterior sobre cualquier cliente o viaje, más armar viajes y consultar usuarios |

Usuarios de prueba (clave `demo1234`): `admin@demo.local`, `cliente@demo.local`, `repartidor1@demo.local` … `repartidor4@demo.local`. La clave de firma sale de `JWT_SECRET`.

La autorización es un guard global (`JwtAuthGuard` + `RolesGuard`) con los decoradores `@Public()` y `@Roles()`; la pertenencia (¿este viaje es de este repartidor?) la deciden funciones puras en cada feature (`trip-access.ts`, `order-access.ts`).

### Tiempo real (WebSocket)

`ws://localhost:3000/tracking?token=<JWT>` (el navegador no puede mandar headers en un WebSocket, por eso el token va en la URL; sin token válido se cierra la conexión). Mensajes JSON `{ "event": ..., "data": ... }`:

| Quién | Envía | Recibe |
|---|---|---|
| Repartidor del viaje (o admin) | `location` `{ tripId, latitude, longitude }` (solo viajes en curso) | `ack` con la posición, o `error` |
| Repartidor del viaje (o admin) | `subscribe` `{ tripId }` | `subscribed` (con la última posición) y luego un `location` por cada cambio |

Para simular un repartidor recorriendo la ruta de un viaje: `cd backend && node scripts/simulate-driver.mjs <tripId>` (entra como admin).

Errores: `400` datos inválidos · `401` sin sesión · `403` sin permiso · `404` no existe · `409` conflicto de estado o sin stock ·
`422` referencia inválida.

Ejemplo:

```bash
TOKEN=$(curl -s localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"cliente@demo.local","password":"demo1234"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')

curl -X POST localhost:3000/orders -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{
  "type": "CUSTOMER",
  "deliveryAddress": {"latitude": -38.714, "longitude": -62.265},
  "items": [{"productId": "a0000000-0000-4000-8000-000000000001", "quantity": 2}]
}'
```

## Mensajes entre servicios

Exchange `logistics.routing` (direct). Los nombres están en `rabbitmq/definitions.json`.

- **`route.requests`** (backend → rutas): `{ tripId, origin: {latitude, longitude}, stops: [{orderId, location}] }`
- **`route.results`** (rutas → backend): `{ tripId, legs: [{ sequenceOrder, toOrderId, geometry: [{latitude, longitude}], distanceKm, estimatedTimeMin, algorithmUsed }] }`

El `tripId` es la clave de idempotencia. `estimatedTimeMin` es entero.

## Tests

```bash
cd backend
npm test                    # unitarios (sin dependencias externas)
npm run test:smoke          # la app levanta con PostgreSQL real; necesita `docker compose up -d postgres`
cd ../routing-service
python -m pytest            # servicio de rutas, sobre grafos armados a mano
```

- Los unitarios usan dobles en memoria (`backend/test/support/in-memory-database.ts`).
- El smoke crea y descarta su propia base (`logistics_test_<uuid>`).
- Los tests se validaron rompiendo el código a propósito (stock, transacciones, idempotencia,
  máquina de estados, contrato de mensajes) para comprobar que fallan cuando deben.

## Variables de entorno

| Variable | Por defecto | Usada por |
|---|---|---|
| `POSTGRES_HOST` / `PORT` / `DB` / `USER` / `PASSWORD` | `localhost` / `5432` / `logistics` / `logistics` / `logistics_dev` | backend |
| `RABBITMQ_HOST` / `PORT` | `localhost` / `5672` | backend, rutas |
| `RABBITMQ_BACKEND_USER` / `PASSWORD` | `backend` / `backend_dev` | backend |
| `RABBITMQ_ROUTER_USER` / `PASSWORD` | `router` / `router_dev` | rutas |
| `ROUTING_ALGORITHM` | `dijkstra` (o `a_star`) | rutas |
| `AVERAGE_SPEED_KMH` | `30` | rutas |
| `MAP_BBOX` | `-62.40,-38.85,-62.10,-38.62` (oeste,sur,este,norte) | rutas |
| `MAP_FILE` / `MAP_MAX_AGE_DAYS` | `cache/map.graphml` / `15` | rutas |
| `OVERPASS_URL` | servidor público de OSM | rutas |
| `JWT_SECRET` | (obligatoria; compose usa una de desarrollo) | backend |
| `JWT_EXPIRES_IN_SECONDS` | `28800` (8 h) | backend |
| `PORT` | `3000` | backend |

Las credenciales son de desarrollo y están fijas en `rabbitmq/definitions.json`.

## Limitaciones conocidas

- La autenticación es mínima: sin registro de usuarios, sin renovación ni revocación de tokens, y el token del WebSocket va en la URL.
- Un cliente no puede seguir su entrega en vivo (el seguimiento es de repartidores y admin).
- El orden de las paradas es voraz, no óptimo.
- El frontend es una demostración mínima, sin tests.
