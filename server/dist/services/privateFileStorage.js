"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPrivateFile = exports.getPrivateFilePath = exports.deletePrivateFiles = exports.storePrivateFiles = exports.receivePrivateFiles = exports.uploadPrivateFiles = exports.InvalidPrivateFileError = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const maxFileSize = 10 * 1024 * 1024;
const storageDirectory = path_1.default.resolve(__dirname, '../../private-uploads');
const allowedFiles = {
    '.pdf': {
        mimeType: 'application/pdf',
        signature: (buffer) => buffer.subarray(0, 5).toString() === '%PDF-',
    },
    '.docx': {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        signature: (buffer) => {
            const content = buffer.toString('latin1');
            return buffer.subarray(0, 4).toString('hex') === '504b0304' &&
                content.includes('[Content_Types].xml') &&
                content.includes('word/document.xml');
        },
    },
    '.jpg': {
        mimeType: 'image/jpeg',
        signature: (buffer) => buffer.subarray(0, 3).toString('hex') === 'ffd8ff',
    },
    '.jpeg': {
        mimeType: 'image/jpeg',
        signature: (buffer) => buffer.subarray(0, 3).toString('hex') === 'ffd8ff',
    },
    '.png': {
        mimeType: 'image/png',
        signature: (buffer) => buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
    },
    '.webp': {
        mimeType: 'image/webp',
        signature: (buffer) => buffer.subarray(0, 4).toString() === 'RIFF' &&
            buffer.subarray(8, 12).toString() === 'WEBP',
    },
};
class InvalidPrivateFileError extends Error {
}
exports.InvalidPrivateFileError = InvalidPrivateFileError;
exports.uploadPrivateFiles = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 5, fields: 30 },
    fileFilter: (_request, file, callback) => {
        const extension = path_1.default.extname(file.originalname).toLowerCase();
        const allowed = allowedFiles[extension];
        if (!allowed || file.mimetype !== allowed.mimeType) {
            callback(new Error('Only PDF, DOCX, JPG, PNG, and WEBP files are supported.'));
            return;
        }
        callback(null, true);
    },
});
const receivePrivateFiles = (fieldName = 'files') => (request, response, next) => {
    exports.uploadPrivateFiles.array(fieldName, 5)(request, response, (error) => {
        if (!error) {
            next();
            return;
        }
        const uploadError = error;
        const tooLarge = uploadError.code === 'LIMIT_FILE_SIZE';
        response.status(tooLarge ? 413 : 400).json({
            error: tooLarge
                ? 'Each uploaded file must be 10 MB or smaller.'
                : uploadError.message || 'The uploaded files could not be accepted.',
        });
    });
};
exports.receivePrivateFiles = receivePrivateFiles;
const validateUpload = (file) => {
    const extension = path_1.default.extname(file.originalname).toLowerCase();
    const allowed = allowedFiles[extension];
    if (!allowed || file.mimetype !== allowed.mimeType || !allowed.signature(file.buffer)) {
        throw new InvalidPrivateFileError(`The uploaded file "${path_1.default.basename(file.originalname)}" is not a valid supported file.`);
    }
};
const safeOriginalName = (value) => path_1.default.basename(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'download';
const storePrivateFiles = async (files, routeForId) => {
    const totalSize = files.reduce((total, file) => total + file.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
        throw new InvalidPrivateFileError('The combined size of uploaded files cannot exceed 25 MB.');
    }
    await promises_1.default.mkdir(storageDirectory, { recursive: true });
    const stored = [];
    try {
        for (const file of files) {
            validateUpload(file);
            const extension = path_1.default.extname(file.originalname).toLowerCase();
            const fileId = (0, crypto_1.randomUUID)();
            const storageKey = `${(0, crypto_1.randomUUID)()}${extension}`;
            await promises_1.default.writeFile(path_1.default.join(storageDirectory, storageKey), file.buffer, { flag: 'wx', mode: 0o600 });
            stored.push({
                fileId,
                storageKey,
                originalName: safeOriginalName(file.originalname),
                mimeType: file.mimetype,
                size: file.size,
                fileUrl: routeForId(fileId),
            });
        }
        return stored;
    }
    catch (error) {
        await (0, exports.deletePrivateFiles)(stored);
        throw error;
    }
};
exports.storePrivateFiles = storePrivateFiles;
const deletePrivateFiles = async (files) => {
    await Promise.all(files.map((file) => promises_1.default.unlink(path_1.default.join(storageDirectory, file.storageKey)).catch((error) => {
        if (error.code !== 'ENOENT')
            throw error;
    })));
};
exports.deletePrivateFiles = deletePrivateFiles;
const getPrivateFilePath = (storageKey) => {
    if (!/^[0-9a-f-]{36}\.(pdf|docx|jpg|jpeg|png|webp)$/i.test(storageKey))
        return null;
    return path_1.default.join(storageDirectory, storageKey);
};
exports.getPrivateFilePath = getPrivateFilePath;
const sendPrivateFile = async (res, file) => {
    const filePath = (0, exports.getPrivateFilePath)(file.storageKey);
    if (!filePath) {
        res.status(404).json({ error: 'File not found.' });
        return;
    }
    try {
        await promises_1.default.access(filePath);
    }
    catch {
        res.status(404).json({ error: 'File not found.' });
        return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type(file.mimeType);
    res.download(filePath, safeOriginalName(file.originalName));
};
exports.sendPrivateFile = sendPrivateFile;
