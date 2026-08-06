import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "s1.sagarmathaserver.top",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER || "info@orbitbustrack.com",
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || "&7y8q_a7Ij+SwMz%",
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function main() {
  console.log("Testing Nodemailer with user:", process.env.SMTP_USER || process.env.EMAIL_USER || "info@orbitbustrack.com");
  try {
    const verified = await transporter.verify();
    console.log("Transporter verification status:", verified);

    const info = await transporter.sendMail({
      from: `"OrbitTrack Platform" <${process.env.SMTP_USER || process.env.EMAIL_USER || "info@orbitbustrack.com"}>`,
      to: "orbitbustracker@gmail.com",
      subject: "Test Email from OrbitTrack backend",
      text: "If you see this, email configuration is working correctly.",
      html: "<p>If you see this, <b>email configuration</b> is working correctly.</p>",
    });

    console.log("Email sent successfully! MessageID:", info.messageId, "Response:", info.response);
  } catch (err) {
    console.error("FAILED to send email:", err);
  }
}

main();
