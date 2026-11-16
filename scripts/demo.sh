set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.demo"
BACKEND_URL="http://localhost:3000"
FRONTEND_PORT=5173
SERVICES=(backend routing frontend)

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

wait_for() {
  local what="$1" timeout="$2"; shift 2
  local waited=0
  until "$@" >/dev/null 2>&1; do
    sleep 1; waited=$((waited + 1))
    [ "$waited" -ge "$timeout" ] && fail "Se agotó la espera de: $what. Mirá $RUN_DIR/*.log"
  done
  echo "  ok: $what"
}

is_running() { [ -f "$RUN_DIR/$1.pid" ] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null; }

start_service() {
  local name="$1" dir="$2"; shift 2
  ( cd "$dir"; setsid "$@" > "$RUN_DIR/$name.log" 2>&1 < /dev/null & echo $! > "$RUN_DIR/$name.pid" )
}

stop_services() {
  for name in "${SERVICES[@]}"; do
    if is_running "$name"; then
      kill -- "-$(cat "$RUN_DIR/$name.pid")" 2>/dev/null || kill "$(cat "$RUN_DIR/$name.pid")" 2>/dev/null || true
      echo "  detenido: $name"
    fi
    rm -f "$RUN_DIR/$name.pid"
  done
}

backend_up() { curl -fs "$BACKEND_URL/branches" -o /dev/null; }
log_has()    { grep -q "$2" "$RUN_DIR/$1.log" 2>/dev/null; }

cmd_status() {
  for name in "${SERVICES[@]}"; do
    if is_running "$name"; then echo "  corriendo: $name"; else echo "  detenido:  $name"; fi
  done
  docker compose -f "$ROOT/docker-compose.yml" ps --format '  {{.Name}}: {{.State}}' 2>/dev/null || true
}

cmd_stop() {
  say "Deteniendo"
  mkdir -p "$RUN_DIR"
  stop_services
  docker compose -f "$ROOT/docker-compose.yml" stop postgres rabbitmq >/dev/null 2>&1 && echo "  detenido: postgres y rabbitmq (datos conservados)" || true
}

cmd_start() {
  local reset="${1:-}"
  mkdir -p "$RUN_DIR"

  command -v docker >/dev/null || fail "Falta docker"
  [ -x "$ROOT/routing-service/.venv/bin/python" ] || fail "Falta el entorno de Python: cd routing-service && python -m venv .venv && .venv/bin/pip install -r requirements.txt"
  [ -d "$ROOT/backend/node_modules" ] || fail "Faltan las dependencias del backend: cd backend && npm install"
  if backend_up && ! is_running backend; then
    fail "Ya hay algo respondiendo en $BACKEND_URL que no arrancó este script. Cerralo o usá 'scripts/demo.sh stop'."
  fi

  say "1/5 Base de datos y RabbitMQ"
  stop_services
  if [ "$reset" = "reset" ]; then
    docker compose -f "$ROOT/docker-compose.yml" down -v
  fi
  docker compose -f "$ROOT/docker-compose.yml" up -d postgres rabbitmq
  wait_for "PostgreSQL" 90 docker exec logistics-postgres pg_isready -U logistics -d logistics
  wait_for "RabbitMQ" 120 docker exec logistics-rabbitmq rabbitmq-diagnostics -q ping
  wait_for "usuarios de RabbitMQ cargados" 60 bash -c "docker exec logistics-rabbitmq rabbitmqctl list_users | grep -q router"

  say "2/5 Datos de ejemplo"
  docker exec -i logistics-postgres psql -U logistics -d logistics -q < "$ROOT/db/seed.sql" >/dev/null
  echo "  ok: sucursales, productos, stock, clientes y repartidores"

  say "3/5 Backend"
  start_service backend "$ROOT/backend" npm run start:dev
  wait_for "API en $BACKEND_URL" 120 backend_up
  wait_for "consumidor de resultados" 60 log_has backend "Escuchando resultados"

  say "4/5 Servicio de rutas"
  start_service routing "$ROOT/routing-service" "$ROOT/routing-service/.venv/bin/python" -u -m app.main
  wait_for "servicio de rutas conectado" 60 log_has routing "Esperando pedidos"

  say "5/5 Frontend"
  start_service frontend "$ROOT" python3 -m http.server "$FRONTEND_PORT" --directory "$ROOT/frontend"
  wait_for "frontend" 30 curl -fs "http://localhost:$FRONTEND_PORT/" -o /dev/null

  say "Todo listo"
  cat <<MSG
  Frontend:  http://localhost:$FRONTEND_PORT
  API:       $BACKEND_URL
  RabbitMQ:  http://localhost:15672   (logistics / logistics_dev)
  Logs:      $RUN_DIR/{backend,routing,frontend}.log
  Prueba:    python3 scripts/smoke.py
  Detener:   scripts/demo.sh stop
MSG
}

case "${1:-start}" in
  start)  cmd_start ;;
  reset)  cmd_start reset ;;
  status) cmd_status ;;
  stop)   cmd_stop ;;
  *)      fail "Uso: $0 [start|reset|status|stop]" ;;
esac
