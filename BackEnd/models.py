from database import Base
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    age = Column(Integer)
    gender = Column(String)
    hashed_password = Column(String)
    push_token = Column(String, nullable=True)

    trips = relationship('Trip', back_populates='user')

class Trip(Base):
    __tablename__ = 'trips'

    id = Column(Integer, primary_key=True, index=True)
    origin_name = Column(String)
    target_name = Column(String)
    time = Column(DateTime(timezone=True))
    route_coordinates = Column(JSON)
    gender = Column(String)
    user_id = Column(Integer, ForeignKey('users.id'))

    user = relationship('User', back_populates='trips')