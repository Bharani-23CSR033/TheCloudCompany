import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDatabase } from './config/db.js'
import authRoutes from './routes/auth.js'

const app = express()
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '10kb' }))
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Campus Auction API is running' }))
app.use('/api/auth', authRoutes)
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }))
app.use((error, req, res, next) => { console.error(error); res.status(error.status || 500).json({ message: 'Something went wrong on the server.' }) })

const port = process.env.PORT || 5000
if (process.env.NODE_ENV !== 'test') connectDatabase().then(() => app.listen(port, () => console.log(`API listening on port ${port}`))).catch((error) => { console.error(`Database connection failed: ${error.message}`); process.exit(1) })
export default app
