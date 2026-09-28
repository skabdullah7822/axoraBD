import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Users2, Banknote, Share2, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton } from "@/components/section-loader";
import { TutorialButton } from "@/components/tutorial-button";

export const Route = createFileRoute("/app/referrals")({
  head: () => ({ meta: [{ title: "Referrals — AxoraBD" }] }),
  staticData: { title: "Referrals" },
  component: ReferralsPage,
});

function ReferralsPage() {
  const { session } = useAuth();
  const { profile, isActive } = useProfile();
  const [earnings, setEarnings] = useState<any[]>([]);
  const [referred, setReferred] = useState<any[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!session?.user) return;
    const [e, r, summary, s] = await Promise.all([
      supabase.from("referral_earnings").select("*").eq("referrer_id", session.user.id).order("created_at", { ascending: false }),
      supabase.rpc("get_my_referrals" as any),
      supabase.rpc("get_my_referral_summary" as any),
      supabase.from("settings").select("*").limit(1).maybeSingle(),
    ]);
    setEarnings(e.data ?? []);
    setReferred((r.data as any[]) ?? []);
    setDuplicateCount(Number((summary.data as any[])?.[0]?.duplicate_count ?? 0));
    setSettings(s.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!session?.user) return;
    load();
    const ch = supabase.channel(`refs-${session.user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_earnings", filter: `referrer_id=eq.${session.user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const refLink = typeof window !== "undefined" && profile?.referral_code
    ? `${window.location.origin}/auth/register?ref=${profile.referral_code}` : "";
  const totalEarned = earnings.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.amount), 0);
  const pending = earnings.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount), 0);

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied!"); };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: "Join AxoraBD", text: "Earn money by completing tasks!", url: refLink });
    else copy(refLink);
  };

  return (
    <>
      <div className="mb-4 flex justify-end"><TutorialButton sectionKey="referrals" /></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardContent></Card>
          ))
        ) : (
          <>

        <Card><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users2 className="h-3.5 w-3.5" /> TOTAL REFERRED</div>
          <p className="text-3xl font-bold mt-1">{referred.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Banknote className="h-3.5 w-3.5" /> TOTAL EARNED</div>
          <p className="text-3xl font-bold mt-1 text-success">৳{totalEarned.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Banknote className="h-3.5 w-3.5" /> PENDING</div>
          <p className="text-3xl font-bold mt-1 text-warning">৳{pending.toFixed(2)}</p>
        </CardContent></Card>
          </>
        )}
      </div>

      {duplicateCount > 0 && (
        <Card className="mb-6 border-warning/30 bg-warning/10">
          <CardContent className="p-4">
            <p className="font-semibold text-warning">Duplicate accounts were not counted</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You opened {duplicateCount} duplicate account{duplicateCount === 1 ? "" : "s"} from the same IP address. These accounts were not added to your valid referral count, and no referral bonus was awarded for them.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/30">
        <CardHeader><CardTitle>Your referral link</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {(settings as any)?.referral_bonus_type === "percent"
              ? <>Earn <span className="text-success font-bold">{Number((settings as any)?.referral_bonus_percent ?? 0)}%</span> of each friend's activation amount when they activate.</>
              : <>Earn <span className="text-success font-bold">৳{settings?.referral_bonus ?? 1}</span> for each friend who activates their account.</>}
          </p>
          {!isActive ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-6 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center">
                <Lock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="font-semibold">Your referral code is locked</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Activate your account to unlock your referral code and start earning rewards.
                </p>
              </div>
              <div className="space-y-2 max-w-sm mx-auto pt-2">
                <div className="flex gap-2">
                  <Input value="••••••••" readOnly disabled className="font-mono font-bold text-lg text-center" />
                  <Button variant="outline" disabled><Lock className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2">
                  <Input value="https://•••••••••••••••••••••••••" readOnly disabled />
                  <Button variant="outline" disabled><Lock className="h-4 w-4" /></Button>
                </div>
              </div>
              <Link to="/app/profile">
                <Button className="bg-gradient-to-r from-primary to-primary/80">
                  <Sparkles className="h-4 w-4" /> Activate to unlock
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Referral code</p>
                <div className="flex gap-2">
                  <Input value={profile?.referral_code ?? ""} readOnly className="font-mono font-bold text-lg" />
                  <Button variant="outline" onClick={() => copy(profile?.referral_code ?? "")}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Share link</p>
                <div className="flex gap-2">
                  <Input value={refLink} readOnly />
                  <Button variant="outline" onClick={() => copy(refLink)}><Copy className="h-4 w-4" /></Button>
                  <Button onClick={share}><Share2 className="h-4 w-4" /> Share</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Referred users</CardTitle></CardHeader>
          <CardContent>
            {loading ? <ListSkeleton count={3} /> : referred.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No referrals yet. Share your link!</p>
            ) : (
              <div className="space-y-2">
                {referred.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/40 border border-border">
                    <div>
                      <p className="font-medium text-sm">{u.username}</p>
                      <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={u.status === "active" ? "default" : "secondary"}
                      className={u.status === "active" ? "bg-success/20 text-success border-success/30" : ""}>
                      {u.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Earnings history</CardTitle></CardHeader>
          <CardContent>
            {loading ? <ListSkeleton count={3} /> : earnings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No earnings yet.</p>
            ) : (
              <div className="space-y-2">
                {earnings.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/40 border border-border">
                    <div>
                      <p className="font-semibold text-sm">+৳{Number(e.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={e.status === "approved" ? "default" : "secondary"}
                      className={e.status === "approved" ? "bg-success/20 text-success border-success/30" :
                        e.status === "pending" ? "bg-warning/20 text-warning border-warning/30" : ""}>
                      {e.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
