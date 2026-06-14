import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, User, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { supabase } from "@/lib/supabase";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("נא להזין שם מלא"); return; }
    if (password !== confirmPassword) { setError("הסיסמאות אינן תואמות"); return; }
    if (password.length < 6) { setError("הסיסמה חייבת להכיל לפחות 6 תווים"); return; }
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role: 'admin' } },
      });
      if (signUpError) throw signUpError;
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "ההרשמה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' });
      if (verifyError) throw verifyError;
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "קוד האימות שגוי");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) setError(error.message);
  };

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="אימות אימייל" subtitle={`שלחנו קוד לכתובת ${email}`}>
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מאמת...</> : "אמת חשבון"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          לא קיבלת קוד?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">שלח שוב</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="יצירת חשבון"
      subtitle="יצירת חשבון — תוכל להיכנס מיד לאחר האימות"
      footer={
        <>כבר יש לך חשבון?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">כניסה</Link>
        </>
      }
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">שם מלא</Label>
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="fullName" type="text" autoFocus placeholder="ישראל ישראלי"
              value={fullName} onChange={e => setFullName(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">אימייל</Label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">סיסמה</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">אימות סיסמה</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />יוצר חשבון...</> : "צור חשבון"}
        </Button>
      </form>
    </AuthLayout>
  );
}
