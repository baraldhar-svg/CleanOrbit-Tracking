import fs from 'fs';

const authScreenPath = 'apps/frontend/src/pages/auth-screen.tsx';
let authScreen = fs.readFileSync(authScreenPath, 'utf8');

authScreen = authScreen.replace(
  `interface FoundUser {
  name: string;
  role: string;
  requiresSchoolCode: boolean;
  demoCode: string;
  requiresPassword?: boolean;
  hasEmail?: boolean;
}`,
  `interface FoundUser {
  name: string;
  role: string;
  requiresSchoolCode: boolean;
  demoCode: string;
  requiresPassword?: boolean;
  hasEmail?: boolean;
  email?: string;
}`
);

authScreen = authScreen.replace(
  `        requiresPassword: data.requiresPassword ?? false,
        hasEmail: data.hasEmail ?? false,
      };`,
  `        requiresPassword: data.requiresPassword ?? false,
        hasEmail: data.hasEmail ?? false,
        email: data.maskedEmail ?? data.user?.email ?? "",
      };`
);

authScreen = authScreen.replace(
  `      if (fu.requiresSchoolCode) {
        setStep("schoolCode");
      } else {
        setStep("otp");
      }`,
  `      if (fu.requiresSchoolCode) {
        setStep("schoolCode");
      } else {
        if (fu.hasEmail && fu.role !== "superadmin") {
          apiPost("/auth/send-email-otp", {
            phone,
            schoolCode: "",
            forceEmailSend: true,
          }).catch(console.error);
          setSuccessMsg(\`Please check your email \${fu.email ? '(' + fu.email + ')' : ''} for the OTP.\`);
          setEmailOtpSent(true);
        }
        setStep("otp");
      }`
);

authScreen = authScreen.replace(
  `  async function handleSendEmailOtp(forceEmailSend = false) {
    if (foundUser?.requiresSchoolCode && !schoolCode.trim()) {
      setErr("Please enter your school code");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await apiPost("/auth/send-email-otp", {
        phone,
        schoolCode: schoolCode.trim(),
        forceEmailSend: forceEmailSend || foundUser?.hasEmail,
      });
      setEmailOtpSent(true);
      setStep("otp");
      if (forceEmailSend || foundUser?.hasEmail) setSuccessMsg("Please check your email, an OTP has been sent.");
    } catch (e: unknown) {`,
  `  async function handleSendEmailOtp(forceEmailSend = false) {
    if (foundUser?.requiresSchoolCode && !schoolCode.trim()) {
      setErr("Please enter your school code");
      return;
    }
    setErr("");
    setLoading(true);

    const shouldForceEmail = forceEmailSend || !!foundUser?.hasEmail;

    try {
      await apiPost("/auth/send-email-otp", {
        phone,
        schoolCode: schoolCode.trim(),
        forceEmailSend: shouldForceEmail,
      });
      setEmailOtpSent(true);
      setStep("otp");
      if (shouldForceEmail) setSuccessMsg(\`Please check your email \${foundUser?.email ? '(' + foundUser.email + ')' : ''}, an OTP has been sent.\`);
    } catch (e: unknown) {`
);

authScreen = authScreen.replace(
  `  async function handleSendOtp() {
    if (foundUser?.requiresSchoolCode && !schoolCode.trim()) {
      setErr("Please enter your school code");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await apiPost("/auth/send-email-otp", { phone, schoolCode: schoolCode.trim() });
      setStep("otp");
      setSuccessMsg("Please check your SMS/email for the OTP");
    } catch (e: unknown) {`,
  `  async function handleSendOtp() {
    if (foundUser?.requiresSchoolCode && !schoolCode.trim()) {
      setErr("Please enter your school code");
      return;
    }
    setErr("");
    setLoading(true);
    
    const shouldForceEmail = !!foundUser?.hasEmail;

    try {
      await apiPost("/auth/send-email-otp", { 
        phone, 
        schoolCode: schoolCode.trim(),
        forceEmailSend: shouldForceEmail
      });
      setStep("otp");
      if (shouldForceEmail) {
        setEmailOtpSent(true);
        setSuccessMsg(\`Please check your email \${foundUser?.email ? '(' + foundUser.email + ')' : ''} for the OTP\`);
      } else {
        setSuccessMsg("Please check your SMS for the OTP");
      }
    } catch (e: unknown) {`
);

authScreen = authScreen.replace(
  `                  <p className="text-xs text-amber-400 mt-2 font-medium">
                    {emailOtpSent ? "Please check your email for the OTP" : "Enter the OTP code"}
                  </p>`,
  `                  <p className="text-xs text-amber-400 mt-2 font-medium">
                    {emailOtpSent 
                       ? \`Please check your email \${foundUser?.email ? '(' + foundUser.email + ')' : ''} for the OTP\` 
                       : "Enter the OTP code"}
                  </p>`
);

fs.writeFileSync(authScreenPath, authScreen);
console.log('Fixed auth-screen.tsx');

const authTsPath = 'apps/backend/src/routes/auth.ts';
let authTs = fs.readFileSync(authTsPath, 'utf8');

authTs = authTs.replace(
  `    return res.json({
      found: true,
      verified: false,
      user: { ...user, tenant },
      requiresSchoolCode: user.role !== "superadmin" && !!user.tenantId,
      hasEmail: !!user.email,
    });`,
  `    return res.json({
      found: true,
      verified: false,
      user: { ...user, tenant },
      requiresSchoolCode: user.role !== "superadmin" && !!user.tenantId,
      hasEmail: !!user.email,
      maskedEmail: user.email ? (user.email.split('@')[0].length > 2 ? user.email.split('@')[0].substring(0, 2) + '***@' + user.email.split('@')[1] : user.email.split('@')[0] + '***@' + user.email.split('@')[1]) : undefined,
    });`
);

fs.writeFileSync(authTsPath, authTs);
console.log('Fixed auth.ts');
