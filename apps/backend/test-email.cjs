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
  console.log("Testing Gmail SMTP with user:", process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com");
  try {
    const verified = await transporter.verify();
    console.log("Transporter verification status:", verified);

    const info = await transporter.sendMail({
      from: `"OrbitTrack Platform" <orbitbustracker@gmail.com>`,
      to: "istuti11332@gmail.com",
      subject: "Test Email from OrbitTrack Platform",
      text: "This is a test email to verify Nodemailer setup.",
    });

    console.log("SUCCESS! Email sent! MessageID:", info.messageId, "Response:", info.response);
  } catch (err) {
    console.error("FAILED to send email:", err);
  }
}

main();
