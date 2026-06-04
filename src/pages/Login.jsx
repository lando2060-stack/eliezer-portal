import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch {
      setError("כתובת האימייל או הסיסמה שגויים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="כניסה למערכת"
      subtitle="התחבר עם כתובת האימייל והסיסמה שלך"
      footer={
        <>
          אין לך חשבון?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            הירשם עכשיו
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">אימייל</Label>
          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">סיסמה</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">שכחתי סיסמה</Link>
          </div>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} className="pr-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מתחבר...</> : "כניסה"}
        </Button>
      </form>
    </AuthLayout>
  );
}
