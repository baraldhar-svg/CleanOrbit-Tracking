const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com",
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || "puumjkcrmanaewnu",
  },
});

async function main() {
  const targetEmail = "istuti1133@gmail.com";
  console.log("Sending email to REAL address:", targetEmail);
  try {
    const info = await transporter.sendMail({
      from: `"OrbitTrack Platform" <orbitbustracker@gmail.com>`,
      to: targetEmail,
      subject: "OrbitTrack — School Registration Approved & Verification Code (JANAPR202633)",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 25px; background-color: #0f172a; color: #ffffff; border-radius: 12px; max-width: 600px; margin: auto;">
          <h2 style="color: #fbbf24; text-align: center;">OrbitTrack Platform</h2>
          <p>Dear Nilesh Aacharya,</p>
          <p>Your school <b>Janapremi World School</b> registration has been approved!</p>
          <p>School Code: <b style="color: #fbbf24;">JANAPR202633</b></p>
          <p>Verification Link: <a href="https://clean-orbit-tracking.vercel.app/admin-verify?code=JANAPR202633&mobile=9840077623" style="color: #60a5fa;">Click here to verify</a></p>
        </div>
      `,
    });

    console.log("SUCCESS! MessageID:", info.messageId);
  } catch (err) {
    console.error("FAILED to send email:", err);
  }
}

main();
