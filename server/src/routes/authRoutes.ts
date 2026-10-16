import { Router } from 'express';
import { login, logout, getMe, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

export default router;
