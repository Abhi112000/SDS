import mongoose from 'mongoose';
const MessageSchema = new mongoose.Schema({
  fromUserId: String,
  fromName: String,
  fromEmail: String,
  fromPhone: String,
  subject: String,
  text: String,
  orderId: String,
  read: { type: Boolean, default: false },
  replies: [{ from: String, text: String, createdAt: Date }],
  createdAt: { type: Date, default: Date.now }
});
const Message = (mongoose && mongoose.models && mongoose.models.Message) ? mongoose.models.Message : mongoose.model('Message', MessageSchema);
export default Message;
