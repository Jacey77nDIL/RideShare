# RideShare (Carpooling MVP for Nigeria)

[Video Demo](https://www.youtube.com/watch?v=hDBv4IkwuWM)

## Overview

RideShare is a carpooling-focused rideshare MVP built to help users **share trips with people heading in the same direction**, reducing individual transport costs.

The idea came from a real problem: I frequently travel to local hotspots and often wished I could split Uber fares with friends. Most times, friends weren’t available and Uber does not offer carpooling in Nigeria. This project explores how a carpooling system could work locally, even with third-party API limitations.

Despite several constraints (API restrictions, billing limitations), the project was completed as a full-stack engineering exercise focused on **system design, geospatial matching, performance, and security**.

---

## Technologies Used

### Frontend

- React Native (Expo)
- React Native Maps
- React Query
- Expo Notifications

### Backend

- FastAPI
- JWT Authentication
- PostgreSQL
- Redis
- OpenRouteService (ORS) API

### Infrastructure & Utilities

- Redis GeoHash / GeoRadius
- Rate Limiting Middleware
- Structured Logging
- Background Cleanup Tasks

---

## Key Challenges & Design Decisions

### 1. Uber API Restrictions

The original plan involved leveraging Uber’s API to enhance routing and pricing. However, Uber had previously disabled access for this type of use due to abuse.

While this reduced the app’s potential feature set, the project was still completed to validate the **carpooling logic, matching algorithms, and system architecture**.

---

### 2. Maps & Routing Without Google Maps

Due to card and billing limitations at the time, the **Google Maps API** could not be used.

**Solution:**  
Switched to **OpenRouteService (ORS)** for:

- Place autocomplete (typing suggestions)
- Driving route generation
- Route distance and duration

Later, all ORS API calls were **moved entirely to the backend** to:

- Protect private API keys
- Centralize request handling
- Enable caching and rate limiting

---

## Core Features

### Authentication & Security

- JWT-based authentication
- Password hashing
- Dependency injection for database sessions and current user
- Rate limiting middleware to prevent abuse

---

### Trip Creation & Routing

- Location search with typing suggestions via ORS
- Fetching driving route coordinates for trips
- Displaying routes on the map using:
  - React Native Maps
  - Polylines for route visualization
- Trip duration and ETA rendering

---

### Performance Optimizations

- Route caching with Redis to reduce repeated ORS calls
- API rate limiting via middleware
- Centralized logging for debugging and monitoring

---

### Trip Matching System

#### Geospatial Filtering

- Redis GeoHash and GeoRadius queries used to find nearby trips efficiently

#### Route Similarity

- Hausdorff distance algorithm applied to route coordinates
- Trips considered similar if deviation is less than 1000 meters

#### Matching Flow

- `get_matches` endpoint returns compatible trips
- Frontend uses React Query to poll for matches every 1 minute
- Users receive push notifications when matching trips are found

---

### Notifications

- Implemented using Expo Notifications
- Alerts users when a matching trip becomes available or is pending

---

### Maintenance & Cleanup

- Automated routine deletes stale trips every 10 minutes
- Keeps Redis and database entries fresh and relevant

---

## Planned Enhancements

- In-app chat for users who join the same trip
- Improved trip-joining flow and confirmation logic
- Better UX around match acceptance and cancellation

---

## Status

This project is a functional MVP focused on:

- Backend robustness
- Geospatial data handling
- Performance optimization
- Secure API design

It serves as both a practical solution prototype and a demonstration of system design under real-world constraints.
