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
    
    // Check if the API returned an error logically
    // SMS Pasal usually returns 200 HTTP status even for logical errors,
    // so we need to inspect the response body.
    if (data.response_code !== 200 && data.status !== "success" && data.response_code !== "200") {
      console.error("SMS API returned error:", data);
      throw new Error(`SMS Provider Error: ${data.message || JSON.stringify(data)}`);
    }

    console.log("SMS sent successfully", data);
    return data;
  } catch (error) {
    console.error("SMS sending failed:", error);
    throw error;
  }
}
