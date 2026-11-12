import { Router } from 'express';
import {
    approveMentor,
    blacklistMentor,
    blacklistUser,
    listPendingMentors,
    loginAdmin,
    rejectMentor,
    registerAdmin,
    refreshAdminToken,
    logoutAdmin
} from '../controllers/admin.controller.js';
import { authAdmin } from '../middleware/authMiddleware.js';

const adminRouter = Router();

adminRouter.post('/register', registerAdmin);
adminRouter.post('/login', loginAdmin);
adminRouter.post('/refresh', refreshAdminToken);
adminRouter.post('/logout', authAdmin, logoutAdmin);
adminRouter.get('/mentors/pending', authAdmin, listPendingMentors);
adminRouter.patch('/mentors/:mentorId/approve', authAdmin, approveMentor);
adminRouter.patch('/mentors/:mentorId/reject', authAdmin, rejectMentor);
adminRouter.patch('/mentors/:mentorId/blacklist', authAdmin, blacklistMentor);
adminRouter.patch('/users/:userId/blacklist', authAdmin, blacklistUser);

export default adminRouter;
