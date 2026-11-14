import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
        unique: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    mentor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mentor',
        required: true
    },
    amountPaise: {
        type: Number,
        required: true,
        min: 1
    },
    type: {
        type: String,
        enum: ['SESSION_PAYMENT'],
        default: 'SESSION_PAYMENT'
    }
}, { timestamps: true });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;
