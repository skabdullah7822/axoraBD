import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin } from "@/lib/admin-bootstrap.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/skabdullah_999_sg/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — AxoraBD" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthed, loading } = useAuth();
  const bootstrap = useServerFn(bootstrapAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthed) navigate({ to: "/skabdullah_999_sg/admin/dashboard" });
  }, [isAuthed, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await bootstrap({ data: { username, password } });
      if (!res.ok || !res.email) {
        setError(
          res.error && res.error !== "Invalid credentials"
            ? res.error
            : "Invalid username or password.",
        );
        await supabase.from("security_logs").insert({
          username, action: "login_failed", suspicious: true,
        }).then(() => {});
        return;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: res.email, password,
      });
      if (signErr) { setError(friendlyError(signErr)); return; }
      await supabase.from("security_logs").insert({
        username, action: "login_success", suspicious: false,
      });
      navigate({ to: "/skabdullah_999_sg/admin/dashboard" });
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">TaskAdmin</h1>
          <p className="text-sm text-muted-foreground mt-1">Restricted admin access</p>
        </div>
        <form onSubmit={submit} className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-xl">
          <div className="space-y-2">
            <Label htmlFor="u">Username</Label>
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Password</Label>
            <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            <Lock className="h-4 w-4 mr-2" />
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
