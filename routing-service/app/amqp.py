import logging
import time

import pika
from pika.exceptions import AMQPError

from app.config import Config
from app.handler import Outcome, RouteRequestHandler

log = logging.getLogger(__name__)

EXCHANGE = "logistics.routing"
REQUESTS_QUEUE = "route.requests"
RESULTS_KEY = "route.results"
RECONNECT_DELAY_S = 3


class AmqpWorker:
    """Conecta con RabbitMQ y le pasa cada pedido al handler. Se reconecta solo."""

    def __init__(self, config: Config, build_handler) -> None:
        self._config = config
        self._build_handler = build_handler

    def run_forever(self) -> None:
        while True:
            try:
                self._run_once()
            except AMQPError as error:
                log.warning("RabbitMQ no disponible (%r), reintento en %ss", error, RECONNECT_DELAY_S)
                time.sleep(RECONNECT_DELAY_S)

    def _run_once(self) -> None:
        credentials = pika.PlainCredentials(self._config.user, self._config.password)
        params = pika.ConnectionParameters(self._config.host, self._config.port, credentials=credentials, heartbeat=0)
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.confirm_delivery()
        channel.basic_qos(prefetch_count=1)

        def publish(body: bytes) -> None:
            channel.basic_publish(
                EXCHANGE,
                RESULTS_KEY,
                body,
                pika.BasicProperties(delivery_mode=2, content_type="application/json"),
                mandatory=True,
            )

        handler: RouteRequestHandler = self._build_handler(publish)

        def on_message(ch, method, _properties, body) -> None:
            outcome = handler.handle(body, method.redelivered)
            if outcome is Outcome.ACK:
                ch.basic_ack(method.delivery_tag)
            else:
                ch.basic_nack(method.delivery_tag, requeue=outcome is Outcome.RETRY)

        channel.basic_consume(REQUESTS_QUEUE, on_message)
        log.info("Esperando pedidos en %s", REQUESTS_QUEUE)
        channel.start_consuming()
