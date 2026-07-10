#  Distributed Smart Rate Limiter

A production-ready distributed API Rate Limiter built using **Node.js, Express.js, Redis, MongoDB and Docker**.

The project demonstrates how to implement scalable and distributed rate limiting using Redis Lua Scripts while supporting multiple server instances. It also includes JWT Authentication, Role-Based Rate Limiting, Analytics APIs and Swagger API Documentation.

---
![Node.js](https://img.shields.io/badge/Node.js-22-green)
![Express](https://img.shields.io/badge/Express-5-black)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-green)
![Redis Cloud](https://img.shields.io/badge/Redis-Cloud-red)
![Docker](https://img.shields.io/badge/Docker-Enabled-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
---

# Features

## Authentication
- User Registration
- User Login
- JWT Authentication
- Protected Routes
- Password Hashing using bcrypt

---

## Distributed Rate Limiting

Three Redis-based algorithms are implemented.

### 1. Fixed Window Counter
- Fastest implementation
- Simple counter per time window
- Suitable for basic APIs

### 2. Sliding Window Counter
- Prevents burst traffic near window boundaries
- Smooth request distribution
- Better accuracy than Fixed Window

### 3. Token Bucket
- Allows short request bursts
- Smooth long-term request rate
- Commonly used in production systems

All algorithms use **Redis Lua Scripts**, making every operation atomic and race-condition free.

---

#  Role-Based Rate Limiting

The system supports three user roles.

| Role | Limit |
|------|--------|
| FREE | 20 Requests / Minute |
| PREMIUM | 100 Requests / Minute |
| ADMIN | Unlimited |

Role information is stored inside MongoDB and included inside JWT Tokens.

---

#  Analytics API

The Analytics API provides:

- Total Users
- FREE Users
- PREMIUM Users
- ADMIN Users

Example Response

```json
{
  "success": true,
  "analytics": {
    "totalUsers": 5,
    "freeUsers": 4,
    "premiumUsers": 1,
    "adminUsers": 0
  }
}
```

---

#  Swagger Documentation

Interactive API Documentation is available at:

```
##  Live Demo

API:
https://distributed-smart-rate.onrender.com

Swagger:
https://distributed-smart-rate.onrender.com/api-docs
```

Swagger allows developers to test APIs directly from the browser.

---

#  Project Architecture

```
Client
   │
   ▼
Express Server
   │
   ├──────── JWT Authentication
   │
   ├──────── Role Based Limiter
   │
   ├──────── Fixed Window
   ├──────── Sliding Window
   ├──────── Token Bucket
   │
   ├──────── MongoDB
   │
   └──────── Redis
```

---

#  Project Structure

```
Distributed-Smart-Rate/
│
├── server.js
├── swagger.js
├── docker-compose.yml
│
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── limiters/
│   └── redisClient.js
│
├── scripts/
├── test/
│
└── README.md
```

---

#  Technologies Used

- Node.js
- Express.js
- MongoDB
- Redis
- Docker
- JWT
- bcrypt
- Swagger UI
- Lua Scripts

---

#  Installation

Clone the repository

```bash
git clone https://github.com/Sullu009/Distributed-Smart-Rate.git
```

Install dependencies

```bash
npm install
```

Start Docker

```bash
docker compose up -d
```

Run the server

```bash
npm start
```

---

#  Environment Variables

Create a `.env` file.

```env
PORT=3000

MONGO_URI=your_mongodb_uri

JWT_SECRET=your_secret

PORT=3000

MONGODB_URI=your_mongodb_uri

REDIS_URL=your_redis_cloud_url

JWT_SECRET=your_secret
```

---

#  API Endpoints

## Authentication

| Method | Endpoint |
|---------|----------|
| POST | /api/auth/register |
| POST | /api/auth/login |
| GET | /api/auth/profile |
| PATCH | /api/auth/change-role |

---

## Rate Limiter

| Method | Endpoint |
|---------|----------|
| GET | /api/fixed-window |
| GET | /api/sliding-window |
| GET | /api/token-bucket |

---
#  Deployment

The application is deployed on Render.

**Live API**

https://distributed-smart-rate.onrender.com

**Swagger Documentation**

https://distributed-smart-rate.onrender.com/api-docs
---

## Analytics

| Method | Endpoint |
|---------|----------|
| GET | /api/analytics |

---

#  Testing

You can test all APIs using

- Thunder Client
- Postman
- Swagger UI

---

#  Future Improvements

- Redis Cluster Support
- Prometheus Metrics
- Grafana Dashboard
- Rate Limiting Dashboard
- Admin Panel
- Request History
- API Key Authentication
- User Dashboard

---

#  Author

**Mohammad Sultan**

GitHub:

https://github.com/Sullu009

---

