import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
        index: true
    },
    senderType: {
        type: String,
        enum: ['user', 'mentor'],
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderName: {
        type: String,
        required: true,
        trim: true
    },
    text: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: ''
    },
    imageUrl: {
        type: String,
        trim: true,
        default: ''
    }
}, { timestamps: true });

chatMessageSchema.index({ appointment: 1, createdAt: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;
