from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
import httpx
import os
import schemas
import logging
import redis
import json

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix='/suggestions_routes',
    tags=['suggestions_routes']
)
logging.getLogger("httpx").setLevel(logging.WARNING)

redis_client = redis.Redis(host='localhost', port=6379, db=0)
hash_key = "trips"

orsToken = os.getenv("orsToken")

@router.post("/suggestions")
async def suggestions_request(suggestion_request: schemas.Suggestions_Input):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://api.openrouteservice.org/geocode/autocomplete?api_key={orsToken}&text={suggestion_request.encoded_URI_component}&size=3")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"Error from external API: {exc.response.text}")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=500, detail=f"An error occurred while requesting external API: {exc}")

@router.post("/coordinates")
async def fetch_coordinates(coordinates_data: schemas.Coordinates):

    # if (coordinates data exists):
    # get route coordinates and time
    # else call external api
    # save new coordinates and route coordinates and time

    query_field = json.dumps(coordinates_data.coordinates)
    field_data = redis_client.hget(hash_key, query_field)

    if field_data:
        # get route coordinates
        result = json.loads(field_data)
        coords = result["coordinates"]
        duration = result["duration"]
        return {
            "coordinates": coords,
            "duration": duration
        }
    else:
        url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
        headers = {
            "Authorization": orsToken,
            "Content-Type": "application/json"
        }
        data = { "coordinates": coordinates_data.coordinates}

        try:
            response = httpx.post(url, headers=headers, json=data)
            response.raise_for_status()
            response_json = response.json()
            coords = response_json["features"][0]["geometry"]["coordinates"]
            duration = response_json["features"][0]["properties"]["summary"]["duration"]

            coords_radis = json.dumps(coordinates_data.coordinates)
            value_to_store = json.dumps({
                "coordinates": coords,
                "duration": duration
            })
            redis_client.hset(hash_key, coords_radis, value_to_store)

            return {
                "coordinates": coords,
                "duration": duration
            }
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=exc.response.status_code, detail=f"Error from external API: {exc.response.text}")
        except httpx.RequestError as exc:
            raise HTTPException(status_code=500, detail=f"An error occurred while requesting external API: {exc}")
