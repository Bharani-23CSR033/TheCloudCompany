import jwt from 'jsonwebtoken'
import Student from '../models/Student.js'

export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return next()
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    req.student = await Student.findById(payload.id).select('-password')
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Invalid or expired token.' })
    next(error)
  }
}
