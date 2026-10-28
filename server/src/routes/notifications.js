import { Router } from 'express'
import Notification from '../models/Notification.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100)
    const notifications = await Notification.find({ recipient: req.student._id }).populate('listing', 'title').sort({ createdAt: -1 }).limit(limit)
    const unreadCount = await Notification.countDocuments({ recipient: req.student._id, read: false })
    res.json({ notifications, unreadCount })
  } catch (error) { next(error) }
})

router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.student._id }, { $set: { read: true } }, { new: true }).populate('listing', 'title')
    if (!notification) return res.status(404).json({ message: 'Notification not found.' })
    res.json({ notification })
  } catch (error) { next(error) }
})

router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.student._id, read: false }, { $set: { read: true } })
    res.json({ message: 'Notifications marked as read.' })
  } catch (error) { next(error) }
})

export default router
