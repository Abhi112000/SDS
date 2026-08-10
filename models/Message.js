import mongoose from 'mongoose';
const MessageSchema = new mongoose.Schema({
  fromUserId: String,
  fromName: String,
  fromEmail: String,
  fromPhone: String,
  fromAddress: String,
  toUserId: String,
  toEmail: String,
  subject: String,
  text: String,
  type: { type: String, enum: ['contact', 'feedback', 'update-request', 'support'], default: 'support' },
  orderId: String,
  read: { type: Boolean, default: false },
  replies: [{ from: String, text: String, createdAt: Date }],
  createdAt: { type: Date, default: Date.now }
});
const Message = (mongoose && mongoose.models && mongoose.models.Message) ? mongoose.models.Message : mongoose.model('Message', MessageSchema);
export default Message;
