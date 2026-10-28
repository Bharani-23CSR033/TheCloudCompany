# CampusAuction

A Phase 1 MERN campus marketplace for buying and selling items within a college community.

## Requirements

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

From the project root, install each workspace:

```bash
cd server
npm install
copy .env.example .env

cd ..\client
npm install
copy .env.example .env
```

Configure `server/.env` with `MONGODB_URI`, a strong `JWT_SECRET`, `PORT` (normally `5000`), and `CLIENT_URL` (normally `http://localhost:5173`). Configure `client/.env` with `VITE_API_URL=http://localhost:5000/api`.

Run two VS Code terminals:

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

Open the Vite URL shown in the terminal. The API health check is available at `http://localhost:5000/api/health`.

## Phase 1 API

- `GET /api/health`
- `POST /api/auth/register` with `{ "name", "email", "password" }`
- `POST /api/auth/login` with `{ "email", "password" }`
- `GET /api/auth/profile` with `Authorization: Bearer <token>`

Passwords are hashed with bcrypt and are never returned by the API. Bidding, listing creation, and auction functionality are intentionally deferred to Phase 2.
