import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Student from '../models/Student.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const publicStudent = (student) => ({ id: student._id, name: student.name, email: student.email, createdAt: student.createdAt })
const tokenFor = (student) => jwt.sign({ id: student._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' })

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'Name, email and password are required.' })
    if (name.trim().length < 2) return res.status(400).json({ message: 'Name must be at least 2 characters.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    if (await Student.findOne({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: 'An account with this email already exists.' })
    const student = await Student.create({ name: name.trim(), email: email.toLowerCase().trim(), password: await bcrypt.hash(password, 12) })
    res.status(201).json({ token: tokenFor(student), student: publicStudent(student) })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email?.trim() || !password) return res.status(400).json({ message: 'Email and password are required.' })
    const student = await Student.findOne({ email: email.toLowerCase().trim() }).select('+password')
    if (!student || !(await bcrypt.compare(password, student.password))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    res.json({ token: tokenFor(student), student: publicStudent(student) })
  } catch (error) { next(error) }
})

router.get('/profile', requireAuth, (req, res) => res.json({ student: publicStudent(req.student) }))
export default router
