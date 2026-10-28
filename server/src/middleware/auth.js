import jwt from 'jsonwebtoken'
import Student from '../models/Student.js'

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required.' })
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
    const student = await Student.findById(payload.id).select('-password')
    if (!student) return res.status(401).json({ message: 'Account not found.' })
    req.student = student
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Invalid or expired token.' })
    next(error)
  }
}
