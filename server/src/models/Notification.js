import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  type: { type: String, enum: ['outbid', 'auction_closed', 'provisional_winner', 'seller_decision', 'auction_cancelled', 'handover_completed', 'pickup_failed', 'question_answered', 'saved_search_match'], required: true },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  eventKey: { type: String, required: true, unique: true },
  read: { type: Boolean, default: false, index: true },
}, { timestamps: true })

notificationSchema.index({ recipient: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
