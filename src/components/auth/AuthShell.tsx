import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, Mail, Lock, User, Phone, Gift, MailCheck, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/friendly-error";
import { useSiteLogo, DEFAULT_SITE_LOGO } from "@/hooks/use-site-logo";

type Mode = "login" | "register";

const registerSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  phone: z.string().trim().min(6).max(20),
  password: z.string().min(6).max(72),
  referral_code: z.string().trim().max(16).optional().or(z.literal("")),
});

const steps = [
  { key: "account", title: "Choose a username", subtitle: "This is how others see you", icon: User },
  { key: "contact", title: "Contact details", subtitle: "We'll use these to keep you safe", icon: Mail },
  { key: "security", title: "Secure your account", subtitle: "Pick a strong password", icon: Lock },
] as const;

export function AuthShell({ initialMode, nextPath, referral }: { initialMode: Mode; nextPath?: string; referral?: string }) {
  const navigate = useNavigate();
  const { isAuthed, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const siteLogo = useSiteLogo();

  useEffect(() => {
    if (!loading && isAuthed) {
      if (nextPath) { window.location.href = nextPath; return; }
      navigate({ to: "/app/dashboard" });
    }
  }, [isAuthed, loading, navigate, nextPath]);

  const switchTo = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    const url = m === "login" ? "/auth/login" : "/auth/register";
    window.history.replaceState(null, "", url);
  };

  const isRegister = mode === "register";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-4xl relative rounded-3xl bg-card shadow-2xl border border-border overflow-hidden min-h-[560px] md:min-h-[600px]">
        {/* Desktop: two side-by-side form panels + sliding overlay */}
        <div className="hidden md:block relative h-[600px]">
          {/* Sign In panel — left half, hidden when register mode */}
          <div
            className={`absolute inset-y-0 left-0 w-1/2 flex items-center justify-center p-8 transition-all duration-700 ease-in-out ${isRegister ? "opacity-0 pointer-events-none translate-x-full" : "opacity-100 translate-x-0"}`}
          >
            <LoginForm nextPath={nextPath} />
          </div>

          {/* Sign Up panel — right half, hidden when login mode */}
          <div
            className={`absolute inset-y-0 right-0 w-1/2 flex items-center justify-center p-8 transition-all duration-700 ease-in-out ${isRegister ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none -translate-x-full"}`}
          >
            <RegisterForm referral={referral} />
          </div>

          {/* Sliding red overlay */}
          <div
            className={`absolute inset-y-0 left-1/2 w-1/2 z-20 transition-transform duration-700 ease-in-out ${isRegister ? "-translate-x-full" : "translate-x-0"}`}
          >
            <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground">
              {/* decorative blobs */}
              <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-primary-foreground/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-primary-foreground/5 blur-2xl" />

              <div key={isRegister ? "welcome-back" : "hello-friend"} className="absolute inset-0 flex items-center justify-center px-8 animate-in fade-in duration-500">
                <div className="text-center max-w-xs">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur mb-5 overflow-hidden">
                    <img src={siteLogo || DEFAULT_SITE_LOGO} alt="Site logo" className="h-12 w-12 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_SITE_LOGO; }} />
                  </div>
                  <h2 className="text-3xl font-bold mb-3">
                    {isRegister ? "Welcome Back!" : "Hello, Friend!"}
                  </h2>
                  <p className="text-sm/relaxed opacity-90 mb-8">
                    {isRegister
                      ? "Already a member? Sign in to continue completing engagement tasks and earning rewards."
                      : "Bangladesh's #1 social engagement community. Sign up and grow your YouTube, Facebook, TikTok & Instagram today."}
                  </p>
                  <button
                    type="button"
                    onClick={() => switchTo(isRegister ? "login" : "register")}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-primary-foreground/90 px-8 py-2.5 text-sm font-semibold tracking-wide uppercase hover:bg-primary-foreground hover:text-primary transition-colors"
                  >
                    {isRegister ? "Sign In" : "Sign Up"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: single stacked form with tab toggle */}
        <div className="md:hidden p-6">
          <div className="text-center mb-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 mb-3 shadow-lg shadow-primary/30 overflow-hidden p-2">
              <img src={siteLogo || DEFAULT_SITE_LOGO} alt="Site logo" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_SITE_LOGO; }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{isRegister ? "Join AxoraBD" : "Welcome back"}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isRegister ? "Grow your social presence" : "Sign in to continue"}
            </p>
          </div>
          <div className="relative flex bg-muted rounded-full p-1 mb-6">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary rounded-full shadow transition-transform duration-500 ease-out ${isRegister ? "translate-x-full" : "translate-x-0"}`}
            />
            <button
              type="button"
              onClick={() => switchTo("login")}
              className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${!isRegister ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTo("register")}
              className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-full transition-colors ${isRegister ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
              Sign Up
            </button>
          </div>
          <div className="relative overflow-hidden">
            <div key={mode} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {isRegister ? <RegisterForm referral={referral} /> : <LoginForm nextPath={nextPath} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Login form ---------------- */
function LoginForm({ nextPath }: { nextPath?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(friendlyError(error)); return; }
    if (nextPath) { window.location.href = nextPath; return; }
    navigate({ to: "/app/dashboard" });
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div className="text-center mb-6 hidden md:block">
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="text-xs text-muted-foreground mt-2">to your AxoraBD account</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-e">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="login-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-9" placeholder="you@example.com" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-p">Password</Label>
          <Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="login-p" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-9 pr-10" placeholder="Your password" />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showPw ? "Hide password" : "Show password"}>
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      <Button type="submit" disabled={busy} className="w-full rounded-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 uppercase tracking-wide font-semibold">
        {busy ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}

/* ---------------- Register form ---------------- */
function RegisterForm({ referral }: { referral?: string }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", phone: "", password: "", referral_code: referral || "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);

  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (form.username.trim().length < 3) return "Username must be at least 3 characters";
      if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return "Only letters, numbers and _ allowed";
    }
    if (s === 1) {
      if (!/^\S+@\S+\.\S+$/.test(form.email)) return "Enter a valid email address";
      if (form.phone.trim().length < 6) return "Enter a valid phone number";
    }
    if (s === 2) {
      if (form.password.length < 6) return "Password must be at least 6 characters";
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(""); setDir(1);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => { setError(""); setDir(-1); setStep((s) => Math.max(s - 1, 0)); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep(2);
    if (err) { setError(err); return; }
    setError(""); setBusy(true);
    try {
      const data = registerSchema.parse(form);
      const { data: dupes } = await supabase
        .from("profiles")
        .select("username,email,phone")
        .or(`username.ilike.${data.username},email.ilike.${data.email},phone.eq.${data.phone}`);
      if (dupes && dupes.length > 0) {
        const d = dupes[0] as { username: string; email: string | null; phone: string | null };
        if (d.username?.toLowerCase() === data.username.toLowerCase()) throw new Error("This username is already taken");
        if (d.email?.toLowerCase() === data.email.toLowerCase()) throw new Error("An account with this email already exists");
        if (d.phone === data.phone) throw new Error("An account with this phone number already exists");
        throw new Error("An account with these details already exists");
      }
      let signupIp: string | null = null;
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(1500) });
        const ipJson = await ipRes.json();
        if (typeof ipJson?.ip === "string") signupIp = ipJson.ip;
      } catch {}
      const { data: res, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/app/dashboard`,
          data: { username: data.username, phone: data.phone, referral_code: data.referral_code || null, signup_ip: signupIp },
        },
      });
      if (error) throw error;
      if (!res.session) setSent(true);
      else navigate({ to: "/app/dashboard" });
    } catch (e: any) {
      const msg = e?.message ?? "Sign up failed";
      if (/profiles_username_unique|username already taken/i.test(msg)) { setError("This username is already taken"); setStep(0); }
      else if (/profiles_email_unique/i.test(msg) || /already registered/i.test(msg)) { setError("An account with this email already exists"); setStep(1); }
      else if (/profiles_phone_unique/i.test(msg)) { setError("An account with this phone number already exists"); setStep(1); }
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/50 mb-4 shadow-lg shadow-primary/30">
          <MailCheck className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Verify your email</h2>
        <p className="text-sm text-muted-foreground mt-2">
          We sent a verification link to <span className="font-medium text-foreground">{form.email}</span>.
        </p>
      </div>
    );
  }

  const StepIcon = steps[step].icon;

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="text-center mb-5 hidden md:block">
        <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
        <p className="text-xs text-muted-foreground mt-2">Join AxoraBD free</p>
      </div>

      <div className="mb-4">
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <StepIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{steps[step].title}</div>
            <div className="text-xs text-muted-foreground">{steps[step].subtitle}</div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div key={step} className={dir === 1 ? "animate-in slide-in-from-right-4 fade-in duration-300" : "animate-in slide-in-from-left-4 fade-in duration-300"}>
          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reg-u">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="reg-u" value={form.username} onChange={upd("username")} className="pl-9" placeholder="your_username" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-r">Referral code <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="reg-r" value={form.referral_code} onChange={upd("referral_code")} className="pl-9" placeholder="Friend's code" />
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reg-e">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="reg-e" type="email" value={form.email} onChange={upd("email")} className="pl-9" placeholder="you@example.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-ph">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="reg-ph" value={form.phone} onChange={upd("phone")} className="pl-9" placeholder="01XXXXXXXXX" />
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reg-p">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="reg-p" type={showPw ? "text" : "password"} value={form.password} onChange={upd("password")} className="pl-9 pr-10" placeholder="At least 6 characters" />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs">
                <span className="font-semibold">{form.username}</span> · {form.email}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2 mt-3 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={back} className="flex-1 rounded-full">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button type="button" onClick={nextStep} className="flex-1 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 uppercase tracking-wide font-semibold">
            Continue <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button type="submit" disabled={busy} className="flex-1 rounded-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 uppercase tracking-wide font-semibold">
            {busy ? "Creating…" : "Sign Up"}
          </Button>
        )}
      </div>
    </form>
  );
}
