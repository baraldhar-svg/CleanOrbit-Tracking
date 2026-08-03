export async function sendOtpSms(phone: string, otpCode: string) {
  const apiUrl = "https://sms.smspasal.com/smsapi/index.php";
  const apiKey = "46A70988FF3382";
  const message = `Your OrbitTrack verification code is: ${otpCode}. Valid for 5 minutes.`;

  const params = new URLSearchParams({
    key: apiKey,
    campaign: "9669",
    routeid: "10259",
    type: "text",
    contacts: phone,
    msg: message,
    responsetype: "json",
  });

  try {
    const response = await fetch(`${apiUrl}?${params.toString()}`);
    const data = await response.json();
    console.log("SMS sent successfully", data);
    return data;
  } catch (error) {
    console.error("SMS sending failed:", error);
    throw error;
  }
}
