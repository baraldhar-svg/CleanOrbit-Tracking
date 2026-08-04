import nodemailer from "nodemailer";
import { logger } from "./logger";

// 1. Transporter configuration (uses environment variables with fallback defaults)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com",
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || "puumjkcrmanaewnu", // App Password
  },
});

export interface SendSchoolApprovalEmailResult {
  success: boolean;
  messageId?: string;
  error?: unknown;
}

/**
 * Sends a school approval email with verification details and school code.
 */
export const sendSchoolApprovalEmail = async (
  schoolEmail: string,
  schoolName: string,
  adminName: string,
  schoolCode: string,
  verifyLink: string
): Promise<SendSchoolApprovalEmailResult> => {
  try {
    const fromUser = process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com";

    const mailOptions = {
      from: `"OrbitTrack Platform" <${fromUser}>`,
      to: schoolEmail,
      subject: `OrbitTrack — School Registration Approved & Verification Code (${schoolCode})`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; background-color: #0f172a; color: #ffffff; border-radius: 12px; max-width: 600px; margin: auto; border: 1px solid #334155;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #1e293b;">
            <h2 style="color: #fbbf24; margin: 0; font-size: 24px; font-weight: bold;">OrbitTrack — Smart Bus Platform</h2>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 4px; margin-bottom: 0;">School Admin Registration Approval Confirmation</p>
          </div>
          
          <div style="padding: 20px 0;">
            <p style="font-size: 15px; color: #f8fafc; margin-top: 0;">Dear <b>${adminName}</b>,</p>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
              We are pleased to inform you that your school registration application for <b>${schoolName}</b> has been successfully approved by the Super Admin.
            </p>
            
            <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #334155;">
              <p style="font-size: 13px; color: #94a3b8; margin: 0 0 5px 0;">Your Official School Code</p>
              <p style="font-size: 28px; font-weight: bold; color: #fbbf24; margin: 0; letter-spacing: 2px;">${schoolCode}</p>
            </div>
            
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
              Please use this code to set up your admin account and share it with your drivers, staff, and students for their registration.
            </p>
            
            <div style="text-align: center; margin-top: 25px;">
              <a href="${verifyLink}" style="display: inline-block; background-color: #fbbf24; color: #0f172a; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px;">Complete Admin Setup</a>
            </div>
          </div>
          
          <div style="padding-top: 20px; border-top: 1px solid #1e293b; text-align: center;">
            <p style="font-size: 12px; color: #64748b; margin: 0;">If you did not request this registration, please ignore this email.</p>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">&copy; ${new Date().getFullYear()} Orbit Bus Tracker. All rights reserved.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ messageId: info.messageId, schoolEmail }, "School approval email sent successfully");
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error({ error, schoolEmail }, "Failed to send school approval email");
    return { success: false, error };
  }
};

/**
 * Sends an OTP for user login via Email.
 */
export const sendLoginOtpEmail = async (email: string, otp: string, name: string): Promise<boolean> => {
  try {
    const fromUser = process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com";

    const mailOptions = {
      from: `"OrbitTrack Platform" <${fromUser}>`,
      to: email,
      subject: `Your OrbitTrack Login Code: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; background-color: #0f172a; color: #ffffff; border-radius: 12px; max-width: 600px; margin: auto; border: 1px solid #334155;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #1e293b;">
            <h2 style="color: #fbbf24; margin: 0; font-size: 24px; font-weight: bold;">OrbitTrack</h2>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 4px; margin-bottom: 0;">Secure Login Verification</p>
          </div>
          
          <div style="padding: 20px 0;">
            <p style="font-size: 15px; color: #f8fafc; margin-top: 0;">Hello <b>${name}</b>,</p>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
              Please use the following verification code to complete your sign-in.
            </p>
            
            <div style="background-color: #1e293b; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #334155;">
              <p style="font-size: 13px; color: #94a3b8; margin: 0 0 5px 0;">Your Verification Code</p>
              <p style="font-size: 32px; font-weight: bold; color: #fbbf24; margin: 0; letter-spacing: 4px;">${otp}</p>
            </div>
            
            <p style="font-size: 13px; color: #94a3b8; text-align: center;">
              This code will expire in 5 minutes. Do not share it with anyone.
            </p>
          </div>
          
          <div style="padding-top: 20px; border-top: 1px solid #1e293b; text-align: center;">
            <p style="font-size: 12px; color: #64748b; margin: 0;">If you didn't request this code, please secure your account.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ messageId: info.messageId, email }, "Login OTP email sent successfully");
    
    return true;
  } catch (error) {
    logger.error({ error, email }, "Failed to send login OTP email");
    return false;
  }
};

/**
 * Sends a Super Admin OTP email to baraldhar@gmail.com
 */
export const sendSuperAdminOtpEmail = async (otp: string): Promise<SendSchoolApprovalEmailResult> => {
  try {
    const fromUser = process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com";

    const mailOptions = {
      from: `"OrbitTrack Platform" <${fromUser}>`,
      to: "baraldhar@gmail.com",
      subject: `OrbitTrack Super Admin OTP: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; background-color: #0f172a; color: #ffffff; border-radius: 12px; max-width: 600px; margin: auto; border: 1px solid #334155;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #1e293b;">
            <h2 style="color: #fbbf24; margin: 0; font-size: 24px; font-weight: bold;">OrbitTrack — Super Admin Security</h2>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 4px; margin-bottom: 0;">Verification Code for Super Admin Access</p>
          </div>
          
          <div style="padding: 20px 0; text-align: center;">
            <p style="font-size: 15px; color: #f8fafc; text-align: left;">Dear Super Admin,</p>
            <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; text-align: left;">
              A login request was initiated for the OrbitTrack Super Admin account. Use the following One-Time Password (OTP) to complete your login. This OTP is valid for 10 minutes.
            </p>
            
            <div style="margin: 30px auto; background-color: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 10px; width: 220px; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 0; margin-bottom: 10px; font-weight: bold;">YOUR OTP CODE</p>
              <div style="font-size: 34px; font-family: monospace; font-weight: 900; color: #fbbf24; letter-spacing: 6px;">
                ${otp}
              </div>
            </div>
            
            <p style="font-size: 13px; color: #f43f5e; font-weight: bold; text-align: left;">
              If you did not initiate this login request, please change your credentials immediately.
            </p>
          </div>
          
          <div style="margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 20px; text-align: center;">
            <p style="margin: 0;">Thank you,<br><b>OrbitTrack Support Team</b></p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ messageId: info.messageId }, "Super Admin OTP email sent successfully");
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error({ error }, "Error sending Super Admin OTP email");
    return { success: false, error };
  }
};

export default { sendSchoolApprovalEmail, sendSuperAdminOtpEmail };
