import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, ArrowLeft, Coins, Users2, Clock, ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ActivationRequiredDialog } from "@/components/activation-required-dialog";
import { SubmissionSuccessDialog } from "@/components/submission-success-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Linkified } from "@/lib/linkify";
import { SectionLoader } from "@/components/section-loader";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/app/tasks/$taskId")({
  head: () => ({ meta: [{ title: "Task Details — AxoraBD" }] }),
  staticData: { title: "Task Details" },
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const { session } = useAuth();
  const { isActive } = useProfile();
  
  const [task, setTask] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [proofText, setProofText] = useState("");
  const [busy, setBusy] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const load = async () => {
    const { data: t } = await supabase.from("tasks")
      .select("*, publisher:profiles(username)").eq("id", taskId).maybeSingle();
    setTask(t);
    if (session?.user) {
      const { data: sub } = await supabase.from("task_submissions").select("*")
        .eq("task_id", taskId).eq("user_id", session.user.id).maybeSingle();
      setExisting(sub);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId, session?.user?.id]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []);
    const max = task?.proof_count ?? 1;
    setFiles((prev) => [...prev, ...fs].slice(0, max));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || !task) return;
    if (!isActive) { setActivationOpen(true); return; }
    const need = task.proof_count ?? 1;
    if (task.proof_type !== "text" && files.length < need) {
      toast.error(`Please upload ${need} proof image${need > 1 ? "s" : ""}.`);
      return;
    }
    setBusy(true);
    try {
      const { data: sub, error: subErr } = await supabase.from("task_submissions").insert({
        task_id: task.id, user_id: session.user.id, status: "pending", proof_text: proofText || null,
      }).select().single();
      if (subErr) throw subErr;

      const uploadedPaths: string[] = [];
      try {
        for (const f of files) {
          if (f.size > 5 * 1024 * 1024) throw new Error("Each image must be under 5MB");
          if (!f.type.startsWith("image/")) throw new Error("Only image files are allowed");
          const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${session.user.id}/${sub.id}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage.from("proofs").upload(path, f, {
            contentType: f.type,
            cacheControl: "3600",
            upsert: false,
          });
          if (upErr) throw new Error(upErr.message || "Proof image upload failed");
          uploadedPaths.push(path);
          const { error: proofErr } = await supabase.from("task_submission_proofs").insert({ submission_id: sub.id, image_url: path });
          if (proofErr) throw proofErr;
        }
      } catch (uploadError) {
        if (uploadedPaths.length) await supabase.storage.from("proofs").remove(uploadedPaths);
        await supabase.from("task_submissions").delete().eq("id", sub.id).eq("user_id", session.user.id);
        throw uploadError;
      }
      setFiles([]);
      setProofText("");
      setSuccessOpen(true);
      load();
    } catch (err: any) {
      toast.error(friendlyError(err, "Submission failed"));
    } finally { setBusy(false); }
  };

  if (!task) return <SectionLoader label="Loading task…" />;

  const remaining = task.total_slots - task.completed_slots;
  const proofType = task.proof_type ?? "image";
  const proofCount = task.proof_count ?? 1;

  return (
    <>
      <ActivationRequiredDialog open={activationOpen} onOpenChange={setActivationOpen} />
      <SubmissionSuccessDialog open={successOpen} onOpenChange={setSuccessOpen} reward={Number(task?.reward ?? 0)} />
      <div className="relative max-w-4xl mx-auto">
        <Link to="/app/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to tasks
        </Link>

        <Card className="mb-4 border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <Badge variant="outline" className="text-[10px] uppercase mb-2">{task.category ?? "general"}</Badge>
                <h1 className="text-2xl font-bold">{task.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{(task as any).show_publisher === false ? "by Anonymous publisher" : `by @${task.publisher?.username ?? "—"}`}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase">Reward</p>
                <p className="text-3xl font-bold text-primary flex items-center gap-1"><Coins className="h-6 w-6" />৳{Number(task.reward).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users2 className="h-4 w-4" /> {remaining}/{task.total_slots} slots left</span>
              {task.deadline && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Ends {new Date(task.deadline).toLocaleDateString()}</span>}
              <span className="flex items-center gap-1"><ImageIcon className="h-4 w-4" /> {proofCount} {proofType} proof{proofCount > 1 ? "s" : ""}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent>
            {task.description ? (
              <Linkified text={task.description} className="text-sm leading-relaxed block" />
            ) : <p className="text-sm text-muted-foreground">—</p>}
            {task.instructions && (
              <div className="mt-4 p-4 rounded-lg bg-accent/30 border border-border">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Instructions</p>
                <div className="max-h-[200px] instructions-scroll">
                  <Linkified text={task.instructions} className="text-sm block" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Submit your proof</CardTitle></CardHeader>
          <CardContent>
            {existing ? (
              <div className="rounded-xl bg-accent/40 border border-border p-6 text-center">
                <p className="font-semibold">You already submitted this task.</p>
                <p className="text-sm text-muted-foreground mt-1">Status: <span className="font-medium capitalize">{existing.status}</span></p>
                <Link to="/app/submissions"><Button variant="outline" size="sm" className="mt-4">View my submissions</Button></Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {proofType !== "text" && (
                  <div className="space-y-2">
                    <Label>Upload {proofCount} screenshot{proofCount > 1 ? "s" : ""}</Label>
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <input type="file" accept="image/*" multiple onChange={onFileChange}
                        className="block mx-auto text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer" />
                      <p className="text-xs text-muted-foreground mt-2">{files.length}/{proofCount} selected</p>
                    </div>
                    {files.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {files.map((f, i) => (
                          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                            <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{proofType === "text" ? "Your proof (required)" : "Notes (optional)"}</Label>
                  <Textarea rows={4} value={proofText} onChange={(e) => setProofText(e.target.value)}
                    placeholder="Add any notes or links for the publisher…" required={proofType === "text"} />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-primary to-primary/80">
                  {!isActive ? "🔒 Activate account to submit" : busy ? "Submitting…" : `Submit and earn ৳${Number(task.reward).toFixed(2)}`}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
