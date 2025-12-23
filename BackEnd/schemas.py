from datetime import datetime  
from pydantic import BaseModel, EmailStr
from typing import List, Optional

class AuthDetails(BaseModel):
    email: EmailStr
    age: int
    gender: str
    password: str
    push_token: Optional[str] = None

class CreateUser(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Suggestions_Input(BaseModel):
    encoded_URI_component: str

class Coordinates(BaseModel):
    coordinates: List[List[float]]

class Coordinate_For_Route(BaseModel):
    latitude: float
    longitude: float

class Trips(BaseModel):
    origin_name: str
    target_name: str
    time: datetime
    route_coordinates: List[Coordinate_For_Route]
    access_token: str

class Trips_Return_Response(BaseModel):
    origin_name: str
    target_name: str
    time: datetime
    gender: str

    model_config = {
        "from_attributes": True  # replaces orm_mode in v2
    }

class UserResponse(BaseModel):
    id: int
    email: str
    age: int
    gender: str
    push_token: Optional[str] = None

    class Config:
        from_attributes = True