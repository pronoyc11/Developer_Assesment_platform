import nodemailer from "nodemailer";
import { env } from "../config/env";
import { mailConfig } from "../config/mail";
import { AppError } from "../utils/appError";

export const transporter = nodemailer.createTransport(
  mailConfig.host
    ? {
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        auth: mailConfig.auth,
      }
    : {
        service: "gmail",
        auth: mailConfig.auth,
      },
);

export const sendVerificationOtpEmail = async (
  to: string,
  otp: string,
): Promise<void> => {
  if (!env.SMTP_PASSWORD || !env.SMTP_USER) {
    console.error("Email service error: SMTP host or user is not configured.");
    throw new AppError(
      503,
      "Email delivery service is currently unavailable. Please try resending verification later.",
    );
  }

  const subject = "Developer Assessment Platform - Email Verification Code";

  const text = [
    "Your Developer Assessment Platform verification code is:",
    "",
    otp,
    "",
    "This code expires in 10 minutes.",
    "",
    "If you did not create this account, you can ignore this email.",
    "Do not share this code with anyone.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1a202c; margin-bottom: 16px;">Developer Assessment Platform</h2>
      <p style="color: #4a5568; font-size: 16px; margin-bottom: 12px;">Verify your email address</p>
      <p style="color: #4a5568; font-size: 14px; margin-bottom: 24px;">Use the verification code below to complete your registration:</p>
      <div style="background-color: #f7fafc; border: 1px dashed #cbd5e0; padding: 16px; text-align: center; border-radius: 6px; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2b6cb0;">${otp}</span>
      </div>
      <p style="color: #718096; font-size: 14px; margin-bottom: 8px;">This code expires in <strong>10 minutes</strong>.</p>
      <p style="color: #a0aec0; font-size: 12px; margin-top: 24px; border-top: 1px solid #edf2f7; padding-top: 16px;">
        Do not share this code with anyone. If you did not create this account, please ignore this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: mailConfig.from,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error(
      "Failed to send verification email:",
      error instanceof Error ? error.message : "Unknown error",
    );
    throw new AppError(
      502,
      "Failed to deliver verification email. Your account was created, please request a new verification code.",
    );
  }
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });

export const sendAssessmentInvitationEmail = async (input: {
  to: string;
  assessmentTitle: string;
  recruiterName: string;
  companyName: string | null;
  expiresAt: Date;
  acceptanceUrl: string;
}): Promise<void> => {
  if (!env.SMTP_PASSWORD || !env.SMTP_USER) {
    throw new AppError(503, "Email delivery service is currently unavailable.");
  }

  const organization = input.companyName || input.recruiterName;
  const expiration = input.expiresAt.toISOString();
  const subject = "You are invited to complete an assessment";
  const text = [
    `You have been invited to complete: ${input.assessmentTitle}`,
    `Invitation from: ${organization}`,
    `Accept your invitation: ${input.acceptanceUrl}`,
    `This invitation expires at: ${expiration}`,
    "You must sign in to the invited candidate account to accept.",
  ].join("\n\n");
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2>Assessment invitation</h2>
      <p>${escapeHtml(input.recruiterName)}${input.companyName ? ` (${escapeHtml(input.companyName)})` : ""} invited you to complete:</p>
      <h3>${escapeHtml(input.assessmentTitle)}</h3>
      <p>This invitation expires at ${escapeHtml(expiration)}.</p>
      <p><a href="${escapeHtml(input.acceptanceUrl)}">View and accept invitation</a></p>
      <p>Sign in with the invited candidate account to accept.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: mailConfig.from,
      to: input.to,
      subject,
      text,
      html,
    });
  } catch {
    console.error("Assessment invitation email delivery failed.");
    throw new AppError(502, "Failed to deliver the assessment invitation.");
  }
};
