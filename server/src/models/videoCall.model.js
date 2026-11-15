import mongoose from 'mongoose';

const videoCallSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
        index: true
    },
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'ENDED'],
        default: 'PENDING',
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

videoCallSchema.index({ appointment: 1, status: 1, createdAt: -1 });

const VideoCall = mongoose.model('VideoCall', videoCallSchema);

export default VideoCall;
