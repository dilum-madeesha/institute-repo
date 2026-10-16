import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { RequestHandler } from 'express';

const maxFileSize = 10 * 1024 * 1024;
const storageDirectory = path.resolve(__dirname, '../../private-uploads');

const allowedFiles: Record<string, { mimeType: string; signature: (buffer: Buffer) => boolean }> = {
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
    signature: (buffer) =>
      buffer.subarray(0, 4).toString() === 'RIFF' &&
      buffer.subarray(8, 12).toString() === 'WEBP',
  },
};

export interface StoredPrivateFile {
  fileId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileUrl: string;
}

export class InvalidPrivateFileError extends Error {}

export const uploadPrivateFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 5, fields: 30 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = allowedFiles[extension];
    if (!allowed || file.mimetype !== allowed.mimeType) {
      callback(new Error('Only PDF, DOCX, JPG, PNG, and WEBP files are supported.'));
      return;
    }
    callback(null, true);
  },
});

export const receivePrivateFiles = (fieldName = 'files'): RequestHandler =>
  (request, response, next) => {
    uploadPrivateFiles.array(fieldName, 5)(request, response, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }
      const uploadError = error as Error & { code?: string };
      const tooLarge = uploadError.code === 'LIMIT_FILE_SIZE';
      response.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'Each uploaded file must be 10 MB or smaller.'
          : uploadError.message || 'The uploaded files could not be accepted.',
      });
    });
  };

const validateUpload = (file: Express.Multer.File): void => {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowed = allowedFiles[extension];
  if (!allowed || file.mimetype !== allowed.mimeType || !allowed.signature(file.buffer)) {
    throw new InvalidPrivateFileError(
      `The uploaded file "${path.basename(file.originalname)}" is not a valid supported file.`
    );
  }
};

const safeOriginalName = (value: string): string =>
  path.basename(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'download';

export const storePrivateFiles = async (
  files: Express.Multer.File[],
  routeForId: (fileId: string) => string
): Promise<StoredPrivateFile[]> => {
  const totalSize = files.reduce((total, file) => total + file.size, 0);
  if (totalSize > 25 * 1024 * 1024) {
    throw new InvalidPrivateFileError('The combined size of uploaded files cannot exceed 25 MB.');
  }

  await fs.mkdir(storageDirectory, { recursive: true });
  const stored: StoredPrivateFile[] = [];
  try {
    for (const file of files) {
      validateUpload(file);
      const extension = path.extname(file.originalname).toLowerCase();
      const fileId = randomUUID();
      const storageKey = `${randomUUID()}${extension}`;
      await fs.writeFile(path.join(storageDirectory, storageKey), file.buffer, { flag: 'wx', mode: 0o600 });
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
  } catch (error) {
    await deletePrivateFiles(stored);
    throw error;
  }
};

export const deletePrivateFiles = async (
  files: Array<Pick<StoredPrivateFile, 'storageKey'>>
): Promise<void> => {
  await Promise.all(
    files.map((file) => fs.unlink(path.join(storageDirectory, file.storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    }))
  );
};

export const getPrivateFilePath = (storageKey: string): string | null => {
  if (!/^[0-9a-f-]{36}\.(pdf|docx|jpg|jpeg|png|webp)$/i.test(storageKey)) return null;
  return path.join(storageDirectory, storageKey);
};

export const sendPrivateFile = async (
  res: import('express').Response,
  file: { storageKey: string; originalName: string; mimeType: string }
): Promise<void> => {
  const filePath = getPrivateFilePath(file.storageKey);
  if (!filePath) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  try {
    await fs.access(filePath);
  } catch {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(file.mimeType);
  res.download(filePath, safeOriginalName(file.originalName));
};
