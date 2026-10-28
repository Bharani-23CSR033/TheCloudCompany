import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { answerAssistantMessage } from '../services/aiAssistant.js'

const router = Router()
const requests = new Map()
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 20

router.post('/chat', requireAuth, async (req, res, next) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!message) return res.status(400).json({ message: 'Enter a question for the AI Assistant.' })
    if (message.length > 500) return res.status(400).json({ message: 'Questions must be 500 characters or fewer.' })
    if (Array.isArray(req.body?.history) && (req.body.history.length > 10 || req.body.history.some((item) => !item || typeof item.role !== 'string' || typeof item.content !== 'string' || item.content.length > 1000))) {
      return res.status(400).json({ message: 'Conversation history is invalid or too long.' })
    }
    const key = String(req.student._id)
    const now = Date.now()
    const recent = (requests.get(key) || []).filter((timestamp) => now - timestamp < WINDOW_MS)
    if (recent.length >= MAX_REQUESTS) return res.status(429).json({ message: 'Too many assistant requests. Please wait a minute and try again.' })
    recent.push(now)
    requests.set(key, recent)
    const result = await answerAssistantMessage(message)
    res.json(result)
  } catch (error) { next(error) }
})

export default router
