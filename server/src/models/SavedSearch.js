import mongoose from 'mongoose'

const savedSearchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  name: { type: String, trim: true, maxlength: 80 },
  keyword: { type: String, trim: true, maxlength: 120 },
  category: { type: String, enum: ['Cycle', 'Calculator', 'Books', 'Electronics', 'Other'] },
  condition: { type: String, enum: ['New', 'Like New', 'Good', 'Fair'] },
  maximumPrice: { type: Number, min: 0 },
  minimumPrice: { type: Number, min: 0 },
}, { timestamps: true })

savedSearchSchema.index({ userId: 1, category: 1, condition: 1, maximumPrice: 1, minimumPrice: 1 })

export default mongoose.model('SavedSearch', savedSearchSchema)
