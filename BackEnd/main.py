from fastapi import FastAPI, Request, status, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from starlette.middleware.base import BaseHTTPMiddleware
import schemas, auth, suggestions_routes, trips
import logging
import sys
import time
from collections import defaultdict
from database import engine, SessionLocal
from datetime import datetime
from typing import Annotated, Dict
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from dependencies import get_db
from models import User, Trip, Base
from routine_del_trips import cleanup

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(auth.router)
app.include_router(suggestions_routes.router)
app.include_router(trips.router)

origins = [
    "http://localhost:3000",  # Change to .env
    "http://127.0.0.1:3000",
    "http://192.168.0.178:8000",
    # Add other origins if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Or ["*"] to allow all origins during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level = logging.INFO,
    format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers = [
        logging.StreamHandler(sys.stdout)
    ]
)

# Logger Instance
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(cleanup, "interval", minutes=10, next_run_time=datetime.now())
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_scheduler():
    scheduler.shutdown()

class AdvancedMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.rate_limit_records: Dict[str, float] = defaultdict(float)

    async def dispatch(self, request: Request, call_next):

        path = request.url.path
        if path in ["/docs", "/openapi.json", "/trips/get_matches", "/auth/token"]:
            response = await call_next(request)
            return response

        client_ip = request.client.host
        current_time = time.time()
        if current_time - self.rate_limit_records[client_ip] < 1: # 1 request per second limit
            return Response(content="Rate limit exceeded", status_code=429)
        
        self.rate_limit_records[client_ip] = current_time
        logger.info(f"Request to {path}")

        # Process the request
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        logger.info(f"Response for {path} took {process_time} seconds")
        return response



db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[dict, Depends(auth.get_current_user)]

app.add_middleware(AdvancedMiddleware)

@app.get("/", status_code=status.HTTP_200_OK)
async def user(user: user_dependency, db: db_dependency):
    logger.info("New Active User")
    if user is None:
        raise HTTPException(status_code=401, detail='Authentication failed')
        logger.info("User is not signed in")
    logger.info("User is signed up")
    return {"User": user}

@app.post("/signup")
async def sign_up(data: schemas.AuthDetails):
    print(f"Received Data: {data}")
    return {"message": "Your token is XYZAD"}
    # Get the email, age, gender, and password
    # Create the schemas, model, auth and databse.py
    # Store the credentials in a users table
    # Sign them in with a jwt sent to the frontend

