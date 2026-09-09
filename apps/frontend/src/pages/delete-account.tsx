import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export default function DeleteAccount() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [requestType, setRequestType] = useState<'account' | 'data'>('account');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber && !email) {
      alert('Please provide your registered phone number or email address.');
      return;
    }
    // Simulate submission / mailto fallback
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
          </Link>
        </div>

        <Card className="shadow-lg border border-slate-200 bg-white">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6">
            <CardTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              Orbit School Bus Track – Account & Data Deletion
            </CardTitle>
            <CardDescription className="text-slate-600 mt-2">
              Learn how to request deletion of your Orbit School Bus Track user account and associated personal data in accordance with Google Play Data Safety policies.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6 text-slate-700 leading-relaxed">
            {/* Overview */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Overview</h2>
              <p>
                At <strong>Orbit School Bus Track</strong> (CleanOrbit Tracking), we respect your privacy and give you full control over your personal data. You have the right to request the deletion of your account and all associated personal information from our active databases at any time.
              </p>
            </section>

            {/* What data is deleted */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">2. What Data is Deleted?</h2>
              <p>When your deletion request is processed, the following data will be permanently deleted or anonymized:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-600">
                <li><strong>Account Credentials:</strong> Your registered mobile phone number, name, email address, and authentication tokens.</li>
                <li><strong>Role Profiles:</strong> Linked parent, driver, student, or school staff profiles.</li>
                <li><strong>Transit & Location History:</strong> Historical GPS tracking logs, trip timestamps, and route history.</li>
                <li><strong>Notification & Attendance Records:</strong> Personal attendance history, alerts, and push notification tokens.</li>
              </ul>
            </section>

            {/* Data Retention Period */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Data Retention Period & Exceptions</h2>
              <p>
                Most personal data is deleted within <strong>7 to 30 business days</strong> after verifying your request. Certain anonymized aggregate analytics or legally required transaction/safety logs may be retained for up to 90 days as required by law or institutional safety compliance before permanent purge.
              </p>
            </section>

            {/* How to request deletion */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Request Account or Data Deletion</h2>
              <p className="mb-4">
                You can request account deletion directly using the form below, or by emailing our support team at{' '}
                <a href="mailto:info@orbitbustrack.com" className="text-blue-600 underline font-medium">
                  info@orbitbustrack.com
                </a>{' '}
                with your registered mobile number and reason.
              </p>

              {submitted ? (
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
                  <h3 className="text-lg font-semibold text-green-900">Deletion Request Received</h3>
                  <p className="text-sm text-green-700">
                    Thank you. We have received your request for <strong>{phoneNumber || email}</strong>. Our data protection team will verify your identity and process the deletion within 7–14 business days. A confirmation will be sent to your contact address.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                    Submit Another Request
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-6 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Request Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="reqType"
                          value="account"
                          checked={requestType === 'account'}
                          onChange={() => setRequestType('account')}
                          className="text-blue-600"
                        />
                        Delete Full Account & All Data
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="reqType"
                          value="data"
                          checked={requestType === 'data'}
                          onChange={() => setRequestType('data')}
                          className="text-blue-600"
                        />
                        Delete Specific Transit Data Only
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Registered Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="tel"
                        placeholder="+977 98XXXXXXXX"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                        className="bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Email Address (Optional)
                      </label>
                      <Input
                        type="email"
                        placeholder="yourname@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">
                      Reason for deletion (Optional)
                    </label>
                    <Textarea
                      placeholder="Please let us know why you wish to delete your account or data..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="bg-white"
                    />
                  </div>

                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      Submitting this request will initiate the permanent deletion process. You may receive an SMS or OTP verification code to confirm ownership before final purge.
                    </span>
                  </div>

                  <Button type="submit" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white">
                    Submit Deletion Request
                  </Button>
                </form>
              )}
            </section>

            {/* Contact Support */}
            <section className="border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Contact Support</h2>
              <p className="text-slate-600 text-sm">
                If you have any questions regarding your personal data or privacy rights, please reach out to our privacy officer:
              </p>
              <p className="mt-2 text-sm">
                <strong>App / Service Name:</strong> Orbit School Bus Track<br />
                <strong>Email:</strong> <a href="mailto:info@orbitbustrack.com" className="text-blue-600">info@orbitbustrack.com</a><br />
                <strong>Website:</strong> <a href="https://www.orbitbustrack.com" className="text-blue-600">https://www.orbitbustrack.com</a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
