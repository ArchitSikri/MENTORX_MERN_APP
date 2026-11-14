import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import MentorModel from '../models/mentor.model.js';
import BlacklistedAccount from '../models/blacklistedAccount.model.js';
import userModel from '../models/user.model.js';
import sessionModel from '../models/sessionn.model.js';
import otpModel from '../models/otp.model.js';
import config from '../config/config.js';
import { sendEmail } from '../services/email.service.js';
import { deleteFile, uploadFile } from '../services/imagekit.service.js';
import { generateOtp, getOtpHtml } from '../utils/utils.js';
import { notifyMentorRegistration } from '../../socket.js';

const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/mentor/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function mentorResponse(mentor) {
    return {
        id: mentor._id,
        username: mentor.username,
        email: mentor.email,
        profilePicture: mentor.profilePicture,
        mentorId: mentor.mentorId,
        expertise: mentor.expertise,
        sessionFeePaise: Number(mentor.sessionFeePaise) || 0,
        walletBalance: Number(mentor.walletBalance) || 0,
        status: mentor.status,
        verified: mentor.verified
    };
}

function createUploadFileName(field, originalName) {
    const extension = originalName.match(/\.[a-zA-Z0-9]+$/)?.[0].toLowerCase() || '.jpg';
    return `${field}-${crypto.randomUUID()}${extension}`;
}

async function deleteUploadedFiles(files) {
    const results = await Promise.allSettled(files.map(({ fileId }) => deleteFile(fileId)));
    for (const result of results) {
        if (result.status === 'rejected') {
            console.error('Failed to clean up mentor document from ImageKit:', result.reason);
        }
    }
}

export async function registerMentor(req, res) {
    const body = req.body ?? {};
    const requiredTextFields = ['username', 'email', 'password', 'mentorId'];
    if (requiredTextFields.some((field) => typeof body[field] !== 'string' || !body[field].trim())) {
        return res.status(400).json({
            message: `Required fields: ${requiredTextFields.join(', ')}`
        });
    }
    if (body.UPI_Id != null && typeof body.UPI_Id !== 'string') {
        return res.status(400).json({ message: 'UPI ID must be text' });
    }

    const requiredFileFields = ['Adhar_Card', 'qualificationCertificate'];
    const missingFiles = requiredFileFields.filter((field) => !req.files?.[field]?.[0]);
    if (missingFiles.length > 0) {
        return res.status(400).json({
            message: `Required files: ${missingFiles.join(', ')}`
        });
    }

    const email = body.email.trim().toLowerCase();
    const username = body.username.trim();
    const mentorId = body.mentorId.trim();
    const duplicateMentor = await MentorModel.findOne({
        $or: [{ email }, { username }, { mentorId }]
    });
    if (duplicateMentor || await userModel.exists({ $or: [{ email }, { username }] })) {
        return res.status(409).json({ message: 'Email, username, or mentor ID is already registered' });
    }

    const uploadedFiles = {};
    const uploadedAssets = [];
    try {
        for (const [field, files] of Object.entries(req.files ?? {})) {
            const file = files[0];
            const uploaded = await uploadFile(
                file.buffer,
                createUploadFileName(field, file.originalname),
                file.mimetype
            );
            uploadedFiles[field] = uploaded.url;
            uploadedAssets.push(uploaded);
        }
    } catch (error) {
        await deleteUploadedFiles(uploadedAssets);
        console.error('Failed to upload mentor registration documents:', error);
        return res.status(503).json({
            message: 'Unable to upload mentor documents. Check ImageKit configuration and try again.'
        });
    }

    let mentor;
    const otp = generateOtp();
    try {
        mentor = await MentorModel.create({
            username,
            email,
            password: hashPassword(body.password),
            mentorId,
            UPI_Id: body.UPI_Id?.trim() || null,
            profilePicture: uploadedFiles.profilePicture || '',
            Adhar_Card: uploadedFiles.Adhar_Card,
            qualificationCertificate: uploadedFiles.qualificationCertificate,
            expertise: typeof body.expertise === 'string' ? body.expertise.trim() : '',
            qualifications: typeof body.qualifications === 'string'
                ? body.qualifications.split(',').map((item) => item.trim()).filter(Boolean)
                : [],
            experienceYears: body.experienceYears ?? 0,
            bio: body.bio,
            status: 'PENDING',
            verified: false,
            active: true
        });
        await otpModel.create({ email, mentor: mentor._id, otpHash: hashPassword(otp) });
    } catch (error) {
        if (mentor) {
            await otpModel.deleteMany({ mentor: mentor._id });
            await MentorModel.findByIdAndDelete(mentor._id);
        }
        await deleteUploadedFiles(uploadedAssets);
        throw error;
    }

    try {
        await sendEmail(email, 'OTP Verification', `Your OTP code is ${otp}`, getOtpHtml(otp));
    } catch (error) {
        await otpModel.deleteMany({ mentor: mentor._id });
        await MentorModel.findByIdAndDelete(mentor._id);
        await deleteUploadedFiles(uploadedAssets);
        console.error('Failed to send mentor verification email:', error);
        return res.status(503).json({
            message: 'Unable to send verification email. Check the email configuration and try again.'
        });
    }

    notifyMentorRegistration();
    return res.status(201).json({
        message: 'Mentor registered. Verify your email and wait for admin approval before logging in.',
        mentor: mentorResponse(mentor)
    });
}

export async function verifyMentorEmail(req, res) {
    const { otp, email } = req.body ?? {};
    if (typeof otp !== 'string' || typeof email !== 'string' || !otp || !email.trim()) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const otpDoc = await otpModel.findOne({
        email: email.trim().toLowerCase(),
        otpHash: hashPassword(otp),
        mentor: { $exists: true }
    });
    if (!otpDoc) return res.status(400).json({ message: 'Invalid OTP' });

    const mentor = await MentorModel.findByIdAndUpdate(
        otpDoc.mentor,
        { verified: true },
        { new: true, runValidators: true }
    );
    await otpModel.deleteMany({ mentor: otpDoc.mentor });
    if (!mentor) return res.status(404).json({ message: 'Mentor not found' });

    return res.status(200).json({
        message: 'Email verified. Your account is waiting for admin approval.',
        mentor: mentorResponse(mentor)
    });
}

export async function loginMentor(req, res) {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const mentor = await MentorModel.findOne({ email: email.trim().toLowerCase() });
    if (!mentor || mentor.password !== hashPassword(password)) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!mentor.verified) return res.status(403).json({ message: 'Email not verified' });
    if (mentor.status !== 'APPROVED') {
        return res.status(403).json({ message: `Mentor account is ${mentor.status.toLowerCase()}` });
    }
    if (
        !mentor.active ||
        await BlacklistedAccount.exists({ accountType: 'mentor', accountId: mentor._id })
    ) {
        return res.status(403).json({ message: 'Mentor account is inactive' });
    }

    const refreshToken = jwt.sign({ _id: mentor._id }, config.JWT_SECRET, { expiresIn: '7d' });
    const session = await sessionModel.create({
        mentor: mentor._id,
        accountType: 'mentor',
        refreshTokenHash: hashRefreshToken(refreshToken),
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    });
    const accessToken = jwt.sign(
        { _id: mentor._id, sessionId: session._id },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    return res.status(200).json({
        message: 'Mentor logged in successfully',
        accessToken,
        mentor: mentorResponse(mentor)
    });
}

export async function refreshMentorToken(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token not found' });

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, config.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const mentorId = decoded._id ?? decoded.id;
    if (typeof mentorId !== 'string') return res.status(401).json({ message: 'Invalid refresh token' });

    const session = await sessionModel.findOne({
        refreshTokenHash: hashRefreshToken(refreshToken),
        mentor: mentorId,
        accountType: 'mentor',
        revoked: false
    });
    if (!session) return res.status(401).json({ message: 'Session not found' });

    const mentor = await MentorModel.findById(mentorId);
    if (
        !mentor || !mentor.active || !mentor.verified || mentor.status !== 'APPROVED' ||
        await BlacklistedAccount.exists({ accountType: 'mentor', accountId: mentorId })
    ) {
        return res.status(403).json({ message: 'Mentor account is not approved or active' });
    }

    const newRefreshToken = jwt.sign({ _id: mentorId }, config.JWT_SECRET, { expiresIn: '7d' });
    session.refreshTokenHash = hashRefreshToken(newRefreshToken);
    await session.save();
    const accessToken = jwt.sign(
        { _id: mentorId, sessionId: session._id },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);
    return res.status(200).json({ message: 'Access token refreshed successfully', accessToken });
}

export async function getMentorMe(req, res) {
    return res.status(200).json({
        message: 'Mentor fetched successfully',
        mentor: mentorResponse(req.mentor)
    });
}

export async function logoutMentor(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'Refresh token not found' });

    const session = await sessionModel.findOne({
        refreshTokenHash: hashRefreshToken(refreshToken),
        mentor: req.mentor._id,
        accountType: 'mentor',
        revoked: false
    });
    if (!session) return res.status(401).json({ message: 'Session not found' });

    session.revoked = true;
    await session.save();
    res.clearCookie('refreshToken', refreshCookieOptions);
    return res.status(200).json({ message: 'Mentor logged out successfully' });
}

export async function logoutAllMentorSessions(req, res) {
    await sessionModel.updateMany(
        { mentor: req.mentor._id, accountType: 'mentor', revoked: false },
        { revoked: true }
    );
    res.clearCookie('refreshToken', refreshCookieOptions);
    return res.status(200).json({ message: 'Logged out from all mentor sessions successfully' });
}
