import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com",
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || "puumjkcrmanaewnu",
  },
});

async function main() {
  console.log("Testing Nodemailer with user:", process.env.SMTP_USER || process.env.EMAIL_USER || "orbitbustracker@gmail.com");
  try {
    const verified = await transporter.verify();
    console.log("Transporter verification status:", verified);

    const info = await transporter.sendMail({
      from: `"OrbitTrack Platform" <${process.env.SMTP_USER || "orbitbustracker@gmail.com"}>`,
      to: "istuti11332@gmail.com",
      subject: "Test Email from OrbitTrack Platform",
      text: "This is a test email to verify Nodemailer setup.",
    });

    console.log("Email sent successfully! MessageID:", info.messageId, "Response:", info.response);
  } catch (err) {
    console.error("FAILED to send email:", err);
  }
}

main();
