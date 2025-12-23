from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
import httpx
import os
import jwt
import json
import schemas
import logging
import pytz
from sqlalchemy.orm import Session
from typing import Annotated, List
from starlette import status
from database import SessionLocal
from datetime import datetime
from dependencies import get_db
from hausdorff import similarity
from models import User, Trip
import redis
from datetime import timedelta
from dependencies import get_current_user_id
from exponent_server_sdk import PushClient, PushMessage

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix='/trips',
    tags=['trips']
)

db_dependency = Annotated[Session, Depends(get_db)]

redis_client = redis.Redis(host='localhost', port=6379, db=0)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("AlGORITHM")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Get trip data
# Get user from jwt and get their gender
# save to DB
# delete trip at the appropriate time from db
# Get all trips from DB

async def protected_route(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except (JWTError, jwt.PyJWTError):
        raise credentials_exception

async def find_matches_pipeline(db: Session, trip_id: int, route_coordinates_json: str):
    # 1. Parse coordinates
    coordinates_list = json.loads(route_coordinates_json)
    start_lon = coordinates_list[0]['longitude']
    start_lat = coordinates_list[0]['latitude']
    end_lon = coordinates_list[-1]['longitude']
    end_lat = coordinates_list[-1]['latitude']

    # 2. Update Redis (Ensures this trip is indexable)
    redis_client.geoadd('trips_geo_hash', (start_lon, start_lat, f"{trip_id}:start"))
    redis_client.geoadd('trips_geo_hash', (end_lon, end_lat, f"{trip_id}:end"))

    # 3. Find nearby trips using Georadius
    nearby_start_bytes = redis_client.georadius('trips_geo_hash', start_lon, start_lat, 2, unit='km')
    nearby_end_bytes = redis_client.georadius('trips_geo_hash', end_lon, end_lat, 2, unit='km')
    
    nearby_start = [item.decode('utf-8').split(':')[0] for item in nearby_start_bytes]
    nearby_end = [item.decode('utf-8').split(':')[0] for item in nearby_end_bytes]

    # 4. Filter for trips that match both ends
    nearby_trips_intersect = list(set(nearby_start) & set(nearby_end))
    
    # Remove current trip ID so you don't match with yourself
    nearby_trips = [int(tid) for tid in nearby_trips_intersect if int(tid) != trip_id]

    # 5. Final Step: Pass the survivors to the Time + Path algorithm
    if not nearby_trips:
        return []
        
    return await carpool_match(db=db, trip_id=trip_id, nearby_trips=nearby_trips)

@router.post("/post_trips")
async def post_trips(db: db_dependency, trips_schema: schemas.Trips):

    try:
        payload = jwt.decode(trips_schema.access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate token")
    
    user = db.query(User).filter(User.id == user_id).first()
    previously_stored_trip = db.query(Trip).filter(Trip.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if previously_stored_trip is not None:
        return {"message": "User already has a trip"}

    else:
        route_coordinates_json = json.dumps([
            {"latitude": coord.latitude, "longitude": coord.longitude}
            for coord in trips_schema.route_coordinates
        ])

        create_trip = Trip(
            origin_name=trips_schema.origin_name,
            target_name=trips_schema.target_name,
            time=trips_schema.time,
            gender=user.gender,
            route_coordinates=route_coordinates_json,
            user_id=user.id,
        )

        db.add(create_trip)
        logger.info("New Trip Created")
        db.commit()
        db.refresh(create_trip)

        matches = await find_matches_pipeline(db, create_trip.id, route_coordinates_json)
        print(matches)
        return {"trip": create_trip, "matches": matches}

@router.get("/get_matches")
async def get_matches(db: db_dependency, trip_id: int):
    # Fetch the trip belonging to the user currently looking at the screen
    current_trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not current_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Run the pipeline to find who matches with this trip
    matches = await find_matches_pipeline(db, current_trip.id, current_trip.route_coordinates)
    
    if not matches or isinstance(matches, dict):
        return []

    matched_trip_data = []
    seen_ids = set()
    notified_user_ids = set() 

    for match in matches:
        # Determine the ID of the 'other' trip
        if match["trip1_id"] == current_trip.id:
            other_id = match["trip2_id"]
        elif match["trip2_id"] == current_trip.id:
            other_id = match["trip1_id"]
        else:
            continue

        if other_id == current_trip.id or other_id in seen_ids:
            continue

        # Fetch the 'other' trip details
        matched_trip = db.query(Trip).filter(Trip.id == other_id).first()
        
        if matched_trip:
            seen_ids.add(other_id)
            matched_trip_data.append({
                "id": matched_trip.id,
                "origin": matched_trip.origin_name,
                "destination": matched_trip.target_name,
                "time": matched_trip.time,
                "gender": matched_trip.gender
            })

            # notify the owner of the 'matched_trip' that 'current_trip' user is a match
            if matched_trip.user_id not in notified_user_ids:
                other_user = db.query(User).filter(User.id == matched_trip.user_id).first()
                
                if other_user and other_user.push_token:
                    send_push_notification(
                        other_user.push_token,
                        "New Carpool Match! 🚗",
                        f"A new user is traveling from {current_trip.origin_name} to {current_trip.target_name}. Check your matches!"
                    )
                    # Mark as notified so we don't send 2+ pings if they have multiple matching trips
                    notified_user_ids.add(matched_trip.user_id)
            
    return matched_trip_data

@router.post("/get_trip_status")
async def get_trip_status(db: db_dependency, user_id: int = Depends(get_current_user_id)):
    trip = db.query(Trip).filter(Trip.user_id == user_id).first()
    return bool(trip)

@router.get("/carpool_match")
async def carpool_match(db: db_dependency, trip_id: int, nearby_trips: List):
    # Disqualify based on time
    matches = []
    thirty_minutes = timedelta(minutes=30)

    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    trip_time = trip.time
    matches.append(trip_id)

    for trip in nearby_trips:
        # Avoid matching with yourself if Redis returned your own ID
        if int(trip) == trip_id:
            continue

        matched_trip = db.query(Trip).filter(Trip.id == trip).first()
        
        if matched_trip is None:
            # FIX: Use continue so the loop keeps looking at other trips
            continue 
            
        time_difference = abs(matched_trip.time - trip_time)
        
        if time_difference <= thirty_minutes:
            matches.append(trip)
    
    if len(matches) <= 1:
        return []
    else:
        path_results = similarity(db=db, matches=matches)
        print(path_results)
        # similarity
        # append group_id
    return path_results

@router.post("/cancel_trips")
async def cancel_trips(db: db_dependency, user_id: int = Depends(get_current_user_id)):
    db.query(Trip).filter(Trip.user_id == user_id).delete()
    db.commit()
    return {"message": "Successful"}

@router.post("/fetch_trip")
async def fetch_trip(db: db_dependency, user_id: int = Depends(get_current_user_id)):
    trip = db.query(Trip).filter(Trip.user_id == user_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"trip_id": trip.id}

from exponent_server_sdk import PushClient, PushMessage

def send_push_notification(expo_token, title, message):
    try:
        response = PushClient().publish(
            PushMessage(to=expo_token, title=title, body=message, sound="default")
        )
    except Exception as e:
        print(f"Error sending push: {e}")