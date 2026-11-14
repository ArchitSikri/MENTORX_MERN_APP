import mongoose from 'mongoose';

const mentorSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Name is required'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    profilePicture: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        default: 'Mentor'
    },
    mentorId: {
        type: String,
        required: [true, 'Mentor ID is required'],
        unique: true,
        trim: true
    },
    UPI_Id: {
        type: String,
        default: null,
        trim: true
    },
    sessionFeePaise: {
        type: Number,
        default: 0,
        min: 0
    },
    walletBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    Adhar_Card: {
        type: String,
        required: [true, 'Aadhaar card is required'],
        select: false
    },
    qualificationCertificate: {
        type: String,
        required: [true, 'Qualification certificate is required'],
        select: false
    },
    qualifications: {
        type: [String],
        default: []
    },
    expertise: {
        type: String,
        trim: true,
        default: ''
    },
    experienceYears: {
        type: Number,
        default: 0,
        min: 0
    },
    bio: {
        type: String,
        maxlength: 1000
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
        index: true
    },
    socketId: {
        type: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

const MentorModel = mongoose.model('Mentor', mentorSchema, 'mentors');

export default MentorModel;
