import multer from 'multer';

const allowedImageTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const isQualificationPdf =
            file.fieldname === 'qualificationCertificate' && file.mimetype === 'application/pdf';
        if (!allowedImageTypes.has(file.mimetype) && !isQualificationPdf) {
            const error = new Error('Only JPEG, PNG, GIF, WEBP, BMP images, and PDF qualification certificates are allowed');
            error.status = 415;
            return cb(error);
        }

        return cb(null, true);
    },
});

function handleUpload(parser, req, res, next) {
    parser(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return res.status(status).json({ message: error.message });
        }

        if (error.status === 415) {
            return res.status(415).json({ message: error.message });
        }

        return next(error);
    });
}

const parseMentorDocuments = upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'Adhar_Card', maxCount: 1 },
    { name: 'qualificationCertificate', maxCount: 1 }
]);

export function uploadMentorDocuments(req, res, next) {
    return handleUpload(parseMentorDocuments, req, res, next);
}

export function uploadUserProfilePicture(req, res, next) {
    return handleUpload(upload.single('profilePicture'), req, res, next);
}