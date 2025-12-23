from datetime import timedelta, datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette import status
from database import SessionLocal
from models import User
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import jwt, JWTError
from dotenv import load_dotenv
from dependencies import get_db, get_current_user_id
import schemas
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix='/auth',
    tags=['auth']
)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("AlGORITHM")

bcrypt_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='auth/token')

db_dependency = Annotated[Session, Depends(get_db)]

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schemas.UserResponse)
async def create_user(db: db_dependency, create_user_request: schemas.AuthDetails):
    existing_user = db.query(User).filter(User.email == create_user_request.email).first()
    if existing_user is None:
        create_user_model = User(
            email=create_user_request.email,
            age=create_user_request.age,
            gender=create_user_request.gender,
            hashed_password=bcrypt_context.hash(create_user_request.password),
            push_token=None
        )

        db.add(create_user_model)
        logger.info("New User Created")
        db.commit()
        db.refresh(create_user_model)
        db.close()
        return create_user_model
    else:
        db.close()
        logger.info("Account already exists")
        return {"message": "Account already exists"}

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db:db_dependency):
    user = authenticate_user(form_data.username, form_data.password, db)
    if not user:
        logger.error("Could not validate user")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate user')
    logger.info("User successfully logged in")
    token = create_access_token(user.email, user.id)

    return {'access_token': token, 'token_type': 'bearer'}

def authenticate_user(username: str, password: str, db):
    user = db.query(User).filter(User.email == username).first()
    logger.info("Searching for user in db")
    if not user:
        logger.info("User not ound")
        return False
    if not bcrypt_context.verify(password, user.hashed_password):
        return False
    logger.info("User Found")
    return user

def create_access_token(username: str, user_id: int):
    encode = {'sub': username, 'id': user_id}
    return jwt.encode(encode, SECRET_KEY, ALGORITHM)

@router.post("/get_current_user")
async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get('sub')
        user_id: str = payload.get('id')
        if email is None or user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate user.')
        return {'email': email, 'id': user_id}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate user.')

@router.post("/update_push_token")
async def update_push_token(payload: dict, db: db_dependency, user_id: int = Depends(get_current_user_id)):
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.push_token = payload.get("token")
        db.commit()
    return {"message": "Token updated"}