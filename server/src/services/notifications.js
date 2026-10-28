import Notification from '../models/Notification.js'

export async function createNotification({ recipient, type, message, listing, eventKey, session }) {
  if (!recipient || !listing) return
  await Notification.updateOne(
    { eventKey },
    { $setOnInsert: { recipient, type, message, listing, eventKey } },
    { upsert: true, session },
  )
}
