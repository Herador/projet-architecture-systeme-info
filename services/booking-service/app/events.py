import os
import json
import aio_pika

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq/")

_connection: aio_pika.abc.AbstractConnection | None = None
_channel: aio_pika.abc.AbstractChannel | None = None


async def get_channel() -> aio_pika.abc.AbstractChannel:
    global _connection, _channel
    if _connection is None or _connection.is_closed:
        _connection = await aio_pika.connect_robust(RABBITMQ_URL)
    if _channel is None or _channel.is_closed:
        _channel = await _connection.channel()
    return _channel


async def publish_event(exchange_name: str, routing_key: str, body: dict):
    channel = await get_channel()
    exchange = await channel.declare_exchange(
        exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
    )
    await exchange.publish(
        aio_pika.Message(
            body=json.dumps(body, default=str).encode(),
            content_type="application/json",
        ),
        routing_key=routing_key,
    )


async def close_connection():
    global _connection, _channel
    if _channel and not _channel.is_closed:
        await _channel.close()
    if _connection and not _connection.is_closed:
        await _connection.close()
    _connection = None
    _channel = None
