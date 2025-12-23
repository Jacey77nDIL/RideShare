from sqlalchemy.orm import Session
from dependencies import get_db
from database import SessionLocal
import logging
import redis
from models import Trip
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
redis_client = redis.Redis(host='localhost', port=6379, db=0)

def cleanup():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired_trips = db.query(Trip).filter(Trip.time <= now).all()
        expired_ids = [trip.id for trip in expired_trips]

        if expired_ids:
                for t_id in expired_ids:
                    redis_client.zrem('trips_geo_hash', f"{t_id}:start")
                    redis_client.zrem('trips_geo_hash', f"{t_id}:end")

        deleted_count = db.query(Trip).filter(Trip.time <= now).delete()
        db.commit()
        logger.info(f"Deleted {deleted_count} rows at {now}")
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        db.rollback()
    finally:
        db.close()
