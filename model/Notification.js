// models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The user who will receive the notification (userP)
  type: { type: String, enum: ['like', 'comment', 'comment_reply', 'newBlog', 'newQnA'], required: true },
  message: { type: String, required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The user who triggered the notification (userC)
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
