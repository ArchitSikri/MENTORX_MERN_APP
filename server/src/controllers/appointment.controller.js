import mongoose from 'mongoose';
import AppointmentModel from '../models/appointment.model.js';
import MentorModel from '../models/mentor.model.js';

export async function listApprovedMentors(req, res) {
    const mentors = await MentorModel.find({
        active: true,
        verified: true,
        status: 'APPROVED'
    })
        .select('username profilePicture mentorId expertise qualifications experienceYears bio')
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
    }).select('_id');
    if (!mentor) {
        return res.status(404).json({ message: 'This mentor is not available for sessions' });
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
    return res.status(200).json({ appointments });
}

export async function updateAppointmentStatus(req, res) {
    const { appointmentId } = req.params;
    const { status } = req.body ?? {};
    if (!mongoose.isValidObjectId(appointmentId) || !['CONFIRMED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Valid appointment ID and status are required' });
    }

    const appointment = await AppointmentModel.findOneAndUpdate(
        { _id: appointmentId, mentor: req.mentor._id, status: 'PENDING' },
        { $set: { status } },
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
