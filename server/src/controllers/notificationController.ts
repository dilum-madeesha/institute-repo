import { Response } from 'express';
import { EmailNotification } from '../models/EmailNotification';
import { AuthRequest } from '../middleware/auth';
import { retryNotificationManually } from '../services/notificationWorker';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search, sessionId, limit = 100 } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (sessionId) filter.classSessionId = sessionId;
    if (search) {
      filter.$or = [
        { recipientEmail: { $regex: String(search), $options: 'i' } },
        { recipientName: { $regex: String(search), $options: 'i' } },
      ];
    }

    const notifications = await EmailNotification.find(filter)
      .populate('studentId', 'firstName lastName displayName studentNumber')
      .populate('guardianId', 'fullName email phone')
      .populate({
        path: 'classSessionId',
        populate: { path: 'classId', select: 'name classCode' },
      })
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
  }
};

export const getNotificationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notif = await EmailNotification.findById(req.params.id)
      .populate('studentId')
      .populate('guardianId')
      .populate({
        path: 'classSessionId',
        populate: { path: 'classId', select: 'name classCode' },
      });

    if (!notif) {
      res.status(404).json({ error: 'Notification record not found' });
      return;
    }

    res.json(notif);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch notification' });
  }
};

export const retryNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updated = await retryNotificationManually(req.params.id as string, req.user!._id.toString());
    res.json({ message: 'Notification scheduled for retry.', notification: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retry notification' });
  }
};
