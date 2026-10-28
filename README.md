# CampusAuction

A Phase 4 MERN campus marketplace for discovering auctions and placing secure bids within a college community.

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
- `POST /api/listings/:id/bids` (authenticated; JSON body `{ "amount": 123.45 }`)
- `PUT /api/listings/:id` (authenticated owner; multipart form)
- `DELETE /api/listings/:id` (authenticated owner; records `cancelled` status instead of deleting)

Listing fields are `title`, `category`, `description`, `condition`, `startingPrice`, `minimumBidIncrement`, `closingAt`, and one or more `images`. Categories are Cycle, Calculator, Books, Electronics, and Other. Conditions are New, Like New, Good, and Fair.

Uploaded images are stored as files under `server/uploads/` and only their URL paths are stored in MongoDB. JPEG, PNG, and WebP files are accepted, with a maximum of 6 images and 5 MB per image. The upload directory is served at `/uploads/`; generated uploads are ignored by Git.

Passwords are hashed with bcrypt and are never returned by the API. Automatic bidding remains intentionally deferred to a later phase.

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

## Bidding

Bid placement requires a JWT bearer token. The server derives the bidder from that token and enforces the starting price, minimum increment, seller restriction, auction status, and stored closing timestamp. Accepted bids are written together with the listing's leading price in a MongoDB transaction so competing requests cannot both pass validation against the same outdated price.

Transactions require MongoDB replica-set support. MongoDB Atlas supports this by default; for local development, run MongoDB as a single-node replica set and configure the client URI with the replica-set name, such as `?replicaSet=rs0`.

If the API reports `Bidding requires MongoDB replica-set mode`, the local Windows service is still running standalone. Add the following to the existing `C:\Program Files\MongoDB\Server\9.0\bin\mongod.cfg` without changing `storage.dbPath`:

```yaml
replication:
  replSetName: rs0
```

In an elevated PowerShell, restart the existing service:

```powershell
Stop-Service MongoDB
Start-Service MongoDB
```

Update `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/campus-auction?replicaSet=rs0
```

This preserves the existing database files. `mongosh` is not installed in the current environment. After restarting MongoDB, install MongoDB Shell from the official MongoDB package or use a MongoDB Shell available on PATH, then initialize the single-node replica set once:

```powershell
mongosh "mongodb://127.0.0.1:27017/admin" --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

Then restart the API with `npm run dev`. Do not delete the MongoDB data directory or run `rs.initiate` more than once.

## Phase 5 auction lifecycle

The server-side closing worker runs when the API starts and every 30 seconds. It only changes `active` listings whose stored `closingAt` has passed, so running it repeatedly is idempotent:

```text
active -> awaiting_decision       when valid bids exist
active -> unsold                  when no valid bids exist
awaiting_decision -> reserved    seller approves the provisional winner
awaiting_decision -> rejected    seller rejects the provisional price
reserved -> completed             both seller and buyer confirm handover
reserved -> failed_pickup         either participant records failed pickup
reserved -> seller_cancelled      seller records a cancellation reason
```

Late bids are rejected by the bid endpoint even before the scheduled worker runs. A completed, rejected, failed, seller-cancelled, or unsold listing cannot return to an active sale state.

Phase 5 endpoints:

- `GET /api/listings/decisions` — authenticated seller's auctions awaiting decision
- `POST /api/listings/:id/decision` with `{ "decision": "approve" }` or `{ "decision": "reject" }`
- `GET /api/listings/my-sales` — authenticated seller/winner lifecycle view
- `POST /api/listings/:id/handover/confirm` — seller or confirmed buyer confirms pickup
- `POST /api/listings/:id/handover/fail` with `{ "reason": "..." }`
- `POST /api/listings/:id/seller-cancel` with `{ "reason": "..." }`

Winner and handover details are returned only to the listing seller or confirmed winner. Public listing APIs do not expose private account information.
