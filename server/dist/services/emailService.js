"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAbsenceNotificationEmail = exports.initEmailTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
let transporter = null;
let etherealAccount = null;
const initEmailTransporter = async () => {
    if (transporter)
        return transporter;
    if (env_1.ENV.SMTP_HOST && env_1.ENV.SMTP_USER) {
        transporter = nodemailer_1.default.createTransport({
            host: env_1.ENV.SMTP_HOST,
            port: env_1.ENV.SMTP_PORT,
            secure: env_1.ENV.SMTP_SECURE,
            auth: {
                user: env_1.ENV.SMTP_USER,
                pass: env_1.ENV.SMTP_PASS,
            },
        });
        console.log(`[EmailService] Using configured SMTP server (${env_1.ENV.SMTP_HOST}:${env_1.ENV.SMTP_PORT})`);
    }
    else {
        try {
            etherealAccount = await nodemailer_1.default.createTestAccount();
            transporter = nodemailer_1.default.createTransport({
                host: etherealAccount.smtp.host,
                port: etherealAccount.smtp.port,
                secure: etherealAccount.smtp.secure,
                auth: {
                    user: etherealAccount.user,
                    pass: etherealAccount.pass,
                },
            });
            console.log(`[EmailService] SMTP not configured. Using free Ethereal test inbox: ${etherealAccount.user}`);
        }
        catch (err) {
            console.warn('[EmailService] Could not reach Ethereal; falling back to JSON mock transporter.');
            transporter = nodemailer_1.default.createTransport({
                jsonTransport: true,
            });
        }
    }
    return transporter;
};
exports.initEmailTransporter = initEmailTransporter;
const sendAbsenceNotificationEmail = async (params) => {
    const mailer = await (0, exports.initEmailTransporter)();
    const from = `"${env_1.ENV.EMAIL_FROM_NAME}" <${env_1.ENV.EMAIL_FROM_ADDRESS}>`;
    const subject = `Attendance Notification – ${params.studentName} – ${params.className}`;
    const teacherContactInfo = params.teacherEmail
        ? `${params.teacherName || 'the teacher'} at ${params.teacherEmail}`
        : params.teacherName || 'the class teacher';
    const textContent = `
Dear ${params.guardianName},

This is to inform you that ${params.studentName} was marked absent from ${params.className} on ${params.sessionDate}.

If you believe this information is incorrect or would like to inform the teacher of a reason for the absence, please contact ${teacherContactInfo}.

Thank you,
${env_1.ENV.EMAIL_FROM_NAME}
This is an automated attendance notification.
`.trim();
    const htmlContent = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
  <div style="padding-bottom: 16px; border-bottom: 2px solid #3b82f6; margin-bottom: 20px;">
    <h2 style="color: #1e3a8a; margin: 0; font-size: 20px;">${env_1.ENV.EMAIL_FROM_NAME}</h2>
    <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Attendance Management System</p>
  </div>
  
  <p style="color: #334155; font-size: 15px; line-height: 1.5;">Dear <strong>${params.guardianName}</strong>,</p>
  
  <p style="color: #334155; font-size: 15px; line-height: 1.5;">
    This is to inform you that <strong>${params.studentName}</strong> was marked <span style="display: inline-block; padding: 2px 8px; background-color: #fee2e2; color: #b91c1c; font-weight: 600; border-radius: 4px;">ABSENT</span> from <strong>${params.className}</strong> on <strong>${params.sessionDate}</strong>.
  </p>
  
  <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
    <p style="color: #475569; font-size: 14px; margin: 0; line-height: 1.5;">
      If you believe this information is incorrect or would like to inform the teacher of an approved reason for the absence, please contact <strong>${teacherContactInfo}</strong>.
    </p>
  </div>
  
  <p style="color: #475569; font-size: 14px; margin-top: 24px;">
    Thank you,<br />
    <strong>${env_1.ENV.EMAIL_FROM_NAME}</strong>
  </p>
  
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
    This is an automated attendance notification. Please do not reply directly to this email unless directed.
  </div>
</div>
  `.trim();
    const info = await mailer.sendMail({
        from,
        to: params.recipientEmail,
        subject,
        text: textContent,
        html: htmlContent,
    });
    const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
    if (previewUrl) {
        console.log(`[EmailService] Preview Absence Email URL: ${previewUrl}`);
    }
    return {
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
    };
};
exports.sendAbsenceNotificationEmail = sendAbsenceNotificationEmail;
