import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        index: true
    },
    mentor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mentor',
        required: true,
        index: true
    },
    scheduledAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'REJECTED'],
        default: 'PENDING',
        index: true
    },
    sessionFeePaise: {
        type: Number,
        min: 0,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['UNPAID', 'PAID'],
        default: 'UNPAID',
        index: true
    },
    amountPaidPaise: {
        type: Number,
        min: 0,
        default: 0
    },
    paidAt: {
        type: Date,
        default: null
    },
    reason: {
        type: String,
        maxlength: 500,
        default: ''
    }
}, { timestamps: true });

appointmentSchema.index({ mentor: 1, scheduledAt: 1, status: 1 });

const AppointmentModel = mongoose.model('Appointment', appointmentSchema);

export default AppointmentModel;
