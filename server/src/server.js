import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDatabase } from './config/db.js'
import authRoutes from './routes/auth.js'
import listingRoutes from './routes/listings.js'
import { startAuctionCloser } from './services/auctionCloser.js'
import notificationRoutes from './routes/notifications.js'

const app = express()
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '10kb' }))
app.use('/uploads', express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')))
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Campus Auction API is running' }))
app.use('/api/auth', authRoutes)
app.use('/api/listings', listingRoutes)
app.use('/api/notifications', notificationRoutes)
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }))
app.use((error, req, res, next) => {
  console.error(error)
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid listing ID.' })
  if (error.name === 'ValidationError') return res.status(400).json({ message: Object.values(error.errors).map((item) => item.message).join(' ') })
  if (error.code === 11000) return res.status(409).json({ message: 'A listing with these details already exists.' })
  if (error.code === 20 || error.codeName === 'IllegalOperation') return res.status(503).json({ message: error.message || 'MongoDB replica-set mode is required for bidding.' })
  res.status(error.status || 500).json({ message: 'Something went wrong on the server.' })
})

const port = process.env.PORT || 5000
if (process.env.NODE_ENV !== 'test') connectDatabase().then(() => {
  app.listen(port, () => console.log(`API listening on port ${port}`))
  startAuctionCloser()
}).catch((error) => { console.error(`Database connection failed: ${error.message}`); process.exit(1) })
export default app
