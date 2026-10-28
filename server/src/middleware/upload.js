import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'

const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')
fs.mkdirSync(uploadDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`)
  },
})

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, callback) => {
    if (!imageTypes.has(file.mimetype)) {
      const error = new Error('Only JPEG, PNG, and WebP image files are supported.')
      error.code = 'INVALID_FILE_TYPE'
      return callback(error)
    }
    callback(null, true)
  },
}).array('images', 6)

export const uploadDirectoryPath = uploadDirectory
