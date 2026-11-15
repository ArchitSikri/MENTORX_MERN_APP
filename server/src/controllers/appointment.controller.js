import mongoose from 'mongoose';
import AppointmentModel from '../models/appointment.model.js';
import MentorModel from '../models/mentor.model.js';
import userModel from '../models/user.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import ChatMessage from '../models/chatMessage.model.js';
import VideoCall from '../models/videoCall.model.js';
import config from '../config/config.js';
import { generateZegoToken } from '../utils/zegoToken.js';
import { randomUUID } from 'node:crypto';

const VIDEO_CALL_INVITE_TTL_MS = 2 * 60 * 1000;
const VIDEO_CALL_MAX_DURATION_MS = 60 * 60 * 1000;

function isZegoConfigured() {
    return Number.isSafeInteger(config.ZEGO_APP_ID) &&
        config.ZEGO_APP_ID > 0 &&
        typeof config.ZEGO_SERVER_SECRET === 'string' &&
        Buffer.byteLength(config.ZEGO_SERVER_SECRET) === 32;
}

export async function listApprovedMentors(req, res) {
    const mentors = await MentorModel.find({
        active: true,
        verified: true,
        status: 'APPROVED',
        sessionFeePaise: { $gt: 0 }
    })
        .select('username profilePicture mentorId expertise qualifications experienceYears bio sessionFeePaise')
        .sort({ expertise: 1, username: 1 })
        .lean();

    return res.status(200).json({ mentors });
}

export async function createAppointment(req, res) {
    const { mentorId, scheduledAt, reason } = req.body ?? {};
    if (
        typeof mentorId !== 'string' ||
        !mongoose.isValidObjectId(mentorId) ||
        typeof scheduledAt !== 'string' ||
        (reason != null && typeof reason !== 'string')
    ) {
        return res.status(400).json({ message: 'A valid mentor and session date/time are required' });
    }

    const appointmentDate = new Date(scheduledAt);
    if (!Number.isFinite(appointmentDate.getTime()) || appointmentDate <= new Date()) {
        return res.status(400).json({ message: 'Choose a future appointment date and time' });
    }
    if (reason?.trim().length > 500) {
        return res.status(400).json({ message: 'Appointment note cannot exceed 500 characters' });
    }

    const mentor = await MentorModel.findOne({
        _id: mentorId,
        active: true,
        verified: true,
        status: 'APPROVED'
    }).select('_id sessionFeePaise');
    if (!mentor) {
        return res.status(404).json({ message: 'This mentor is not available for sessions' });
    }
    if (!Number.isSafeInteger(mentor.sessionFeePaise) || mentor.sessionFeePaise < 1) {
        return res.status(409).json({ message: 'This mentor has not set a session fee yet' });
    }

    const conflictingAppointment = await AppointmentModel.exists({
        mentor: mentor._id,
        scheduledAt: appointmentDate,
        status: { $in: ['PENDING', 'CONFIRMED'] }
    });
    if (conflictingAppointment) {
        return res.status(409).json({ message: 'This time has already been requested. Choose another time.' });
    }

    const appointment = await AppointmentModel.create({
        user: req.user._id,
        mentor: mentor._id,
        scheduledAt: appointmentDate,
        reason: reason?.trim() || ''
    });

    return res.status(201).json({
        message: 'Mentorship session request sent',
        appointment
    });
}

export async function listUserAppointments(req, res) {
    const appointments = await AppointmentModel.find({ user: req.user._id })
        .populate('mentor', 'username profilePicture mentorId expertise')
        .sort({ scheduledAt: -1 })
        .lean();
    return res.status(200).json({ appointments });
}

export async function listMentorAppointments(req, res) {
    const appointments = await AppointmentModel.find({ mentor: req.mentor._id })
        .populate('user', 'username email profilePicture')
        .sort({ scheduledAt: 1 })
        .lean();
    return res.status(200).json({
        appointments,
        mentorWalletBalance: Number(req.mentor.walletBalance) || 0,
        sessionFeePaise: Number(req.mentor.sessionFeePaise) || 0
    });
}

export async function updateAppointmentStatus(req, res) {
    const { appointmentId } = req.params;
    const { status } = req.body ?? {};
    if (!mongoose.isValidObjectId(appointmentId) || !['CONFIRMED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Valid appointment ID and status are required' });
    }

    const update = { status };
    if (status === 'CONFIRMED') {
        const sessionFeePaise = Number(req.mentor.sessionFeePaise);
        if (!Number.isSafeInteger(sessionFeePaise) || sessionFeePaise < 1) {
            return res.status(400).json({ message: 'Set a session fee before accepting requests' });
        }
        update.sessionFeePaise = sessionFeePaise;
    }

    const appointment = await AppointmentModel.findOneAndUpdate(
        { _id: appointmentId, mentor: req.mentor._id, status: 'PENDING' },
        { $set: update },
        { new: true, runValidators: true }
    ).populate('user', 'username email profilePicture');

    if (!appointment) {
        return res.status(404).json({ message: 'Pending session request not found for this mentor' });
    }

    return res.status(200).json({
        message: `Mentorship session ${status.toLowerCase()}`,
        appointment
    });
}

export async function updateMentorSessionFee(req, res) {
    const { sessionFee } = req.body ?? {};
    if (
        typeof sessionFee !== 'number' ||
        !Number.isFinite(sessionFee) ||
        sessionFee <= 0 ||
        sessionFee > 100000 ||
        Math.round(sessionFee * 100) < 1
    ) {
        return res.status(400).json({ message: 'Session fee must be between ₹0.01 and ₹100,000' });
    }

    const sessionFeePaise = Math.round(sessionFee * 100);
    const updateResult = await MentorModel.updateOne(
        { _id: req.mentor._id },
        { $set: { sessionFeePaise } },
        { runValidators: true }
    );
    if (updateResult.matchedCount !== 1) {
        return res.status(404).json({ message: 'Mentor account not found' });
    }

    return res.status(200).json({
        message: 'Session fee updated successfully',
        sessionFeePaise
    });
}

export async function payForAppointment(req, res) {
    const { appointmentId } = req.params;
    if (!mongoose.isValidObjectId(appointmentId)) {
        return res.status(400).json({ message: 'Invalid appointment ID' });
    }

    let paymentResult;
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const appointment = await AppointmentModel.findOne({
                _id: appointmentId,
                user: req.user._id
            }).session(session);

            if (!appointment) {
                paymentResult = { status: 'NOT_FOUND' };
                return;
            }
            if (appointment.status !== 'CONFIRMED') {
                paymentResult = { status: 'NOT_CONFIRMED' };
                return;
            }
            if (appointment.paymentStatus === 'PAID') {
                paymentResult = {
                    status: 'ALREADY_PAID',
                    amountPaise: appointment.amountPaidPaise,
                    mentorId: appointment.mentor
                };
                return;
            }

            const amountPaise = Number(appointment.sessionFeePaise);
            if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
                paymentResult = { status: 'INVALID_FEE' };
                return;
            }

            const amountRupees = amountPaise / 100;
            const debit = await userModel.collection.updateOne(
                {
                    _id: req.user._id,
                    $expr: {
                        $gte: [
                            { $round: [{ $ifNull: ['$wallet', 0] }, 2] },
                            amountRupees
                        ]
                    }
                },
                [{
                    $set: {
                        wallet: {
                            $round: [
                                { $subtract: [{ $ifNull: ['$wallet', 0] }, amountRupees] },
                                2
                            ]
                        }
                    }
                }],
                { session }
            );
            if (debit.modifiedCount !== 1) {
                const error = new Error('Insufficient wallet balance');
                error.code = 'INSUFFICIENT_WALLET';
                throw error;
            }

            const credit = await MentorModel.collection.updateOne(
                { _id: appointment.mentor },
                [{
                    $set: {
                        walletBalance: {
                            $round: [
                                { $add: [{ $ifNull: ['$walletBalance', 0] }, amountRupees] },
                                2
                            ]
                        }
                    }
                }],
                { session }
            );
            if (credit.matchedCount !== 1) {
                throw new Error('Mentor account was not found while completing session payment');
            }

            appointment.paymentStatus = 'PAID';
            appointment.amountPaidPaise = amountPaise;
            appointment.paidAt = new Date();
            await appointment.save({ session });

            await WalletTransaction.create([{
                appointment: appointment._id,
                user: req.user._id,
                mentor: appointment.mentor,
                amountPaise
            }], { session });

            paymentResult = {
                status: 'PAID',
                amountPaise,
                mentorId: appointment.mentor
            };
        });
    } catch (error) {
        if (error.code === 'INSUFFICIENT_WALLET') {
            return res.status(402).json({ message: 'Not enough wallet balance. Add money to your wallet and try again.' });
        }
        if (error.code === 20 || /transaction numbers are only allowed/i.test(error.message)) {
            return res.status(503).json({
                message: 'Session payments require MongoDB transactions. Use a replica set or MongoDB Atlas.'
            });
        }
        throw error;
    } finally {
        await session.endSession();
    }

    if (paymentResult.status === 'NOT_FOUND') {
        return res.status(404).json({ message: 'Session not found' });
    }
    if (paymentResult.status === 'NOT_CONFIRMED') {
        return res.status(409).json({ message: 'You can pay only after the mentor accepts the session' });
    }
    if (paymentResult.status === 'INVALID_FEE') {
        return res.status(409).json({ message: 'This session does not have a valid fee' });
    }

    const [user, mentor] = await Promise.all([
        userModel.findById(req.user._id).select('wallet').lean(),
        MentorModel.findById(paymentResult.mentorId).select('walletBalance').lean()
    ]);

    return res.status(200).json({
        message: paymentResult.status === 'ALREADY_PAID'
            ? 'This session has already been paid'
            : 'Payment successful. The fee has been credited to the mentor’s Medix wallet.',
        paymentStatus: 'PAID',
        amountPaidPaise: paymentResult.amountPaise,
        userWallet: Number(user?.wallet) || 0,
        mentorWalletBalance: Number(mentor?.walletBalance) || 0
    });
}

async function getPaidChatAppointment(req, res) {
    const { appointmentId } = req.params;
    if (!mongoose.isValidObjectId(appointmentId)) {
        res.status(400).json({ message: 'Invalid appointment ID' });
        return null;
    }

    const actor = req.user
        ? { user: req.user._id }
        : { mentor: req.mentor._id };
    const appointment = await AppointmentModel.findOne({
        _id: appointmentId,
        ...actor,
        status: 'CONFIRMED',
        paymentStatus: 'PAID'
    }).select('_id');
    if (!appointment) {
        res.status(404).json({ message: 'Paid session chat not found' });
        return null;
    }

    return appointment;
}

export async function listAppointmentMessages(req, res) {
    const appointment = await getPaidChatAppointment(req, res);
    if (!appointment) return;

    const messages = await ChatMessage.find({ appointment: appointment._id })
        .sort({ createdAt: -1, _id: -1 })
        .limit(200)
        .lean();
    return res.status(200).json({ messages: messages.reverse() });
}

export async function sendAppointmentMessage(req, res) {
    const appointment = await getPaidChatAppointment(req, res);
    if (!appointment) return;

    const { text } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000) {
        return res.status(400).json({ message: 'Message must contain 1 to 2,000 characters' });
    }

    const isUser = Boolean(req.user);
    const message = await ChatMessage.create({
        appointment: appointment._id,
        senderType: isUser ? 'user' : 'mentor',
        senderId: isUser ? req.user._id : req.mentor._id,
        senderName: isUser ? req.user.username : req.mentor.username,
        text: text.trim()
    });
    return res.status(201).json({ message });
}

export async function getAppointmentVideoCall(req, res) {
    const appointment = await getPaidChatAppointment(req, res);
    if (!appointment) return;

    const now = new Date();
    await VideoCall.updateMany(
        {
            appointment: appointment._id,
            status: { $in: ['PENDING', 'ACCEPTED'] },
            expiresAt: { $lte: now }
        },
        { $set: { status: 'EXPIRED' } }
    );
    const call = await VideoCall.findOne({
        appointment: appointment._id,
        status: { $in: ['PENDING', 'ACCEPTED'] }
    }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ call });
}

export async function createAppointmentVideoCall(req, res) {
    const appointment = await getPaidChatAppointment(req, res);
    if (!appointment) return;
    if (!isZegoConfigured()) {
        return res.status(503).json({ message: 'Video calling is not configured. Contact the administrator.' });
    }

    const now = new Date();
    await VideoCall.updateMany(
        {
            appointment: appointment._id,
            status: { $in: ['PENDING', 'ACCEPTED'] },
            expiresAt: { $lte: now }
        },
        { $set: { status: 'EXPIRED' } }
    );
    const activeCall = await VideoCall.exists({
        appointment: appointment._id,
        status: { $in: ['PENDING', 'ACCEPTED'] }
    });
    if (activeCall) {
        return res.status(409).json({ message: 'A video call is already pending or in progress' });
    }

    const call = await VideoCall.create({
        appointment: appointment._id,
        roomId: randomUUID(),
        expiresAt: new Date(now.getTime() + VIDEO_CALL_INVITE_TTL_MS)
    });
    return res.status(201).json({ call });
}

export async function respondToAppointmentVideoCall(req, res) {
    if (!req.user) {
        return res.status(403).json({ message: 'Only the student can accept or decline this call' });
    }
    const appointment = await getPaidChatAppointment(req, res);
    if (!appointment) return;

    const { callId } = req.params;
    const { status } = req.body ?? {};
    if (!mongoose.isValidObjectId(callId) || !['ACCEPTED', 'DECLINED'].includes(status)) {
        return res.status(400).json({ message: 'A valid call and response are required' });
    }

    const call = await VideoCall.findOneAndUpdate(
        {
            _id: callId,
            appointment: appointment._id,
            status: 'PENDING',
            expiresAt: { $gt: new Date() }
        },
        {
            $set: {
                status,
                ...(status === 'ACCEPTED'
                    ? { expiresAt: new Date(Date.now() + VIDEO_CALL_MAX_DURATION_MS) }
                    : {})
            }
        },
        { new: true, runValidators: true }
    );
    if (!call) {
        return res.status(409).json({ message: 'This video call is no longer available' });
    }

    return res.status(200).json({ call });
}

export async function endAppointmentVideoCall(req, res) {
    const appointment = await getPaidChatAppointment(req, res);
    if (!appointment) return;

    const { callId } = req.params;
    if (!mongoose.isValidObjectId(callId)) {
        return res.status(400).json({ message: 'Invalid call ID' });
    }

    const call = await VideoCall.findOneAndUpdate(
        { _id: callId, appointment: appointment._id, status: 'ACCEPTED' },
        { $set: { status: 'ENDED' } },
        { new: true }
    );
    if (!call) {
        return res.status(409).json({ message: 'This video call is no longer in progress' });
    }
    return res.status(200).json({ call });
}

export async function createAppointmentVideoCallToken(req, res) {
    const appointment = await getPaidChatAppointment(req, res);
    if (!appointment) return;

    const { callId } = req.params;
    if (!mongoose.isValidObjectId(callId)) {
        return res.status(400).json({ message: 'Invalid call ID' });
    }
    const call = await VideoCall.findOne({
        _id: callId,
        appointment: appointment._id,
        status: 'ACCEPTED',
        expiresAt: { $gt: new Date() }
    }).lean();
    if (!call) {
        return res.status(409).json({ message: 'The student must accept the call before joining' });
    }
    if (!isZegoConfigured()) {
        return res.status(503).json({ message: 'Video calling is not configured. Contact the administrator.' });
    }

    const account = req.user || req.mentor;
    const userId = String(account._id);
    const token = generateZegoToken(
        config.ZEGO_APP_ID,
        userId,
        config.ZEGO_SERVER_SECRET
    );

    return res.status(200).json({
        appId: config.ZEGO_APP_ID,
        token,
        roomId: call.roomId,
        userId,
        userName: account.username
    });
}
