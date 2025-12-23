import numpy as np
import json
import pyproj
import math
from sqlalchemy.orm import Session
from typing import List
from scipy.spatial.distance import directed_hausdorff
from models import Trip

def get_utm_zone_nigeria(lon: float) -> str:
    lon = float(lon)

    """Three UTM zones for Nigeria"""
    if lon < 6:
        return "EPSG:32631"  # West
    elif 6 <= lon < 12:
        return "EPSG:32632"  # Central
    else:
        return "EPSG:32633"  # East

def similarity(db: Session, matches: List[int]):
    results = []
    num_matches = len(matches)

    trips_cache = {t.id: t for t in db.query(Trip).filter(Trip.id.in_(matches)).all()}

    for i in range(num_matches):
        # modulo to wrap the last trip back to the first trip
        id1 = matches[i]
        id2 = matches[(i + 1) % num_matches]

        trip1 = trips_cache.get(id1)
        trip2 = trips_cache.get(id2)

        if trip1 and trip2:
            coords_list_1 = json.loads(trip1.route_coordinates)
            coords_list_2 = json.loads(trip1.route_coordinates)
            first_point = coords_list_1[0]
            start_lon = first_point['longitude']
            utm_crs = get_utm_zone_nigeria(start_lon)

            # Project coordinates (Degrees -> Meters)
            transformer = pyproj.Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True)
            point_1 = [(p['longitude'], p['latitude']) for p in coords_list_1]
            point_2 = [(p['longitude'], p['latitude']) for p in coords_list_2]

            trip1_projected = np.array(list(transformer.itransform(point_1)))
            trip2_projected = np.array(list(transformer.itransform(point_2)))

            # The [0] index gets the actual distance from the scipy result
            d_1_to_2 = directed_hausdorff(trip1_projected, trip2_projected)[0]
            d_2_to_1 = directed_hausdorff(trip2_projected, trip1_projected)[0]

            hausdorff_meters = max(d_1_to_2, d_2_to_1)

            if hausdorff_meters < 1000:
                results.append({
                    "trip1_id": id1,
                    "trip2_id": id2,
                    "hausdorff_distance_km": round(hausdorff_meters / 1000, 3),
                    "is_carpoolable": True,
                    "used_utm_zone": utm_crs
                })

    return results