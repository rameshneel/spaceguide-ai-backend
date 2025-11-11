// src/services/communication/email.js
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransporter({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to, subject, text, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    throw new Error(`Email Error: ${error.message}`);
  }
};
