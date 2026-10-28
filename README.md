# CampusAuction

A Phase 3 MERN campus marketplace for discovering auctions within a college community. Bidding is intentionally not implemented yet.

## Requirements

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

From the project root, install each workspace:

```powershell
cd server
npm install
Copy-Item .env.example .env

cd ..\client
npm install
Copy-Item .env.example .env
```

Configure `server/.env` with `MONGODB_URI`, a strong `JWT_SECRET`, `PORT` (normally `5000`), and `CLIENT_URL` (normally `http://localhost:5173`). Configure `client/.env` with `VITE_API_URL=http://localhost:5000/api`.

Run two VS Code terminals:

```powershell
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

Open the Vite URL shown in the terminal. The API health check is available at `http://localhost:5000/api/health`.

## Authentication API

- `GET /api/health`
- `POST /api/auth/register` with name, email, and password JSON fields
- `POST /api/auth/login` with email and password JSON fields
- `GET /api/auth/profile` with an `Authorization` bearer header

## Phase 2 listing API

- `POST /api/listings` (authenticated multipart form; use repeated `images` fields)
- `GET /api/listings` (public active listings; add `?category=Books` to filter)
- `GET /api/listings?mine=true` (authenticated seller listings)
- `GET /api/listings/:id`
- `GET /api/listings/:id/bids` (public, read-only bid history)
- `PUT /api/listings/:id` (authenticated owner; multipart form)
- `DELETE /api/listings/:id` (authenticated owner; records `cancelled` status instead of deleting)

Listing fields are `title`, `category`, `description`, `condition`, `startingPrice`, `minimumBidIncrement`, `closingAt`, and one or more `images`. Categories are Cycle, Calculator, Books, Electronics, and Other. Conditions are New, Like New, Good, and Fair.

Uploaded images are stored as files under `server/uploads/` and only their URL paths are stored in MongoDB. JPEG, PNG, and WebP files are accepted, with a maximum of 6 images and 5 MB per image. The upload directory is served at `/uploads/`; generated uploads are ignored by Git.

Passwords are hashed with bcrypt and are never returned by the API. Bidding and automatic bidding remain intentionally deferred to a later phase.

## Browsing query parameters

`GET /api/listings` supports:

- `q`: searches title and description
- `category`: Cycle, Calculator, Books, Electronics, or Other
- `condition`: New, Like New, Good, or Fair
- `minPrice` and `maxPrice`: non-negative starting-price range
- `closingSoon=true`: active auctions closing within 24 hours
- `sort`: `newest`, `lowestPrice`, or `closingSoon`
- `page`: positive page number (default `1`)
- `limit`: results per page from 1 to 50 (default `12`)

The response includes `pagination` metadata. Public listing responses expose only the seller's display name, never email, password, or authentication data. Detail responses include public bid history and `currentPrice`; with no valid bids, `currentPrice` equals `startingPrice`. The browser countdown is informational only—the server's stored closing timestamp remains authoritative.
