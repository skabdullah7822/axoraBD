import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Clock, Coins, Users2, ListTodo, Lock, ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ActivationRequiredDialog } from "@/components/activation-required-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Paginator } from "@/components/paginator";
import { Linkified } from "@/lib/linkify";
import { CardGridSkeleton } from "@/components/section-loader";
import { friendlyError } from "@/lib/friendly-error";
import { TutorialButton } from "@/components/tutorial-button";
import { AdSlot } from "@/components/ad-slot";

const PAGE_SIZE = 12;
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const Route = createFileRoute("/app/tasks")({
  head: () => ({
    meta: [
      { title: "Engagement Tasks — AxoraBD" },
      { name: "description", content: "Browse real social engagement tasks on AxoraBD — Like, Comment, Follow, Subscribe, View & Share. Complete tasks, submit proof and earn rewards instantly." },
      { property: "og:title", content: "Engagement Tasks — AxoraBD" },
      { property: "og:description", content: "Pick engagement tasks on AxoraBD and help creators grow while earning rewards." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  staticData: { title: "Browse Tasks" },
  component: TasksPage,
});

type ProofField = { id: string; type: string; label: string; required: boolean };

function TasksPage() {
  const { session } = useAuth();
  const { isActive } = useProfile();
  const [paged, setPaged] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(["all"]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<string>("random");
  const [page, setPage] = useState(1);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);

  // Load distinct categories once (lightweight)
  const loadCategories = async () => {
    const { data } = await supabase.from("tasks").select("category").eq("status", "active").limit(1000);
    const s = new Set<string>();
    (data ?? []).forEach((t: any) => t.category && s.add(t.category));
    setCategories(["all", ...Array.from(s)]);
  };

  const loadMine = async () => {
    if (!session?.user) return;
    const { data: subs } = await supabase.from("task_submissions").select("task_id")
      .eq("user_id", session.user.id);
    setMine(new Set((subs ?? []).map((s) => s.task_id).filter((id): id is string => !!id)));
  };

  // Server-side paged fetch — only loads the current page
  const loadPage = async () => {
    setLoading(true);
    let query = supabase
      .from("tasks")
      .select("*, publisher:profiles!tasks_publisher_id_fkey(username, avatar_url)", { count: "exact" })
      .eq("status", "active");

    if (mine.size > 0) {
      query = query.not("id", "in", `(${Array.from(mine).join(",")})`);
    }
    if (q) query = query.ilike("title", `%${q}%`);
    if (cat !== "all") query = query.eq("category", cat);

    if (sort === "reward") query = query.order("reward", { ascending: false });
    else if (sort === "slots") query = query.order("total_slots", { ascending: false });
    else query = query.order("created_at", { ascending: false }); // new + random both use newest from DB

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await query.range(from, to);

    let rows = data ?? [];
    if (sort === "random") rows = shuffle(rows);
    setPaged(rows);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
    loadMine();
    const ch = supabase.channel("tasks-browse")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadPage())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_submissions" }, () => loadMine())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => { setPage(1); }, [q, cat, sort]);
  useEffect(() => { loadPage(); /* eslint-disable-next-line */ }, [q, cat, sort, page, shuffleSeed, mine]);

  const load = loadPage; // used by submission success

  const openDetails = (t: any) => { setSelected(t); };
  const openSubmit = () => {
    if (!isActive) { setActivationOpen(true); return; }
    if (selected?.publisher_id === session?.user?.id) { toast.error("You cannot submit to your own task"); return; }
    setSubmitOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end"><TutorialButton sectionKey="tasks" /></div>
      <ActivationRequiredDialog open={activationOpen} onOpenChange={setActivationOpen} />
      <div className="relative">
        {!isActive && (
          <div className="mb-5 p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3">
            <Lock className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm">
              Your account is <span className="font-semibold text-warning">inactive</span>. You can browse tasks, but you must activate to submit.{" "}
              <Link to="/app/profile" className="underline font-medium">Activate now</Link>
            </p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Random</SelectItem>
              <SelectItem value="new">Newest</SelectItem>
              <SelectItem value="reward">Highest reward</SelectItem>
              <SelectItem value="slots">Most slots</SelectItem>
            </SelectContent>
          </Select>
          {sort === "random" && (
            <Button variant="outline" className="w-full md:w-auto" onClick={() => setShuffleSeed((s) => s + 1)}>
              Shuffle
            </Button>
          )}
        </div>

        {/* Quick category chips */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 scrollbar-none">
            {categories.map((c) => {
              const active = cat === c;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 " +
                    (active
                      ? "bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-transparent shadow-md shadow-primary/30"
                      : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/40")
                  }
                >
                  {c === "all" ? "All" : c}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <CardGridSkeleton count={6} />
        ) : total === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-50" />
            No tasks available right now. Check back soon!
          </CardContent></Card>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((t) => {
              const submitted = mine.has(t.id);
              const remaining = t.total_slots - t.completed_slots;
              const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
              const isNew = ageHours < 24;
              const ratio = t.total_slots > 0 ? remaining / t.total_slots : 1;
              const isHot = Number(t.reward) >= 5 || ratio < 0.3;
              const isLimited = remaining > 0 && remaining <= 5;
              return (
                <Card key={t.id} onClick={() => openDetails(t)}
                  className="group relative overflow-hidden cursor-pointer border-border/60 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/30 overflow-hidden flex items-center justify-center relative">
                    {t.banner_url ? (
                      <img src={t.banner_url} alt={t.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    )}
                    {/* Floating status badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {isNew && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500 text-white shadow-lg animate-pulse">
                          New
                        </span>
                      )}
                      {isHot && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg animate-pulse">
                          🔥 Hot
                        </span>
                      )}
                      {isLimited && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-warning text-warning-foreground shadow-lg animate-pulse">
                          Limited
                        </span>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{t.category ?? "general"}</Badge>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <Coins className="h-4 w-4" />৳{Number(t.reward).toFixed(2)}
                      </div>
                    </div>
                    <h3 className="font-semibold line-clamp-1 mb-1">{t.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users2 className="h-3 w-3" /> {remaining}/{t.total_slots}</span>
                      <span className="truncate ml-2">{(t as any).show_publisher === false ? "Anonymous" : `@${t.publisher?.username ?? "—"}`}</span>
                    </div>
                    {submitted && <Badge className="mt-2 bg-success/20 text-success border-success/30 text-[10px]">Submitted</Badge>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <AdSlot placement="tasks_inline" />
          <Paginator page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </>
        )}
      </div>

      {/* Task details modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              {selected.banner_url && (
                <img src={selected.banner_url} alt="" className="w-full max-h-56 object-cover rounded-lg -mt-2" />
              )}
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] uppercase">{selected.category}</Badge>
                  <Badge className="bg-success/20 text-success border-success/30 text-[10px]">{selected.status}</Badge>
                </div>
                <DialogTitle className="text-xl">{selected.title}</DialogTitle>
                <DialogDescription>{(selected as any).show_publisher === false ? "by Anonymous publisher" : `by @${selected.publisher?.username ?? "—"}`}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-accent/30 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Reward</p>
                  <p className="font-bold text-primary">৳{Number(selected.reward).toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-accent/30 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Slots left</p>
                  <p className="font-bold">{selected.total_slots - selected.completed_slots}/{selected.total_slots}</p>
                </div>
                <div className="p-3 rounded-lg bg-accent/30 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Proof</p>
                  <p className="font-bold capitalize">{((selected.proof_fields as ProofField[])?.length) || selected.proof_count} field{(((selected.proof_fields as ProofField[])?.length) || selected.proof_count) > 1 ? "s" : ""}</p>
                </div>
              </div>

              {selected.description && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                  <Linkified text={selected.description} className="text-sm block" />
                </div>
              )}
              {selected.instructions && (
                <div className="p-3 rounded-lg bg-accent/30 border border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Instructions</p>
                  <div className="max-h-[200px] instructions-scroll">
                    <Linkified text={selected.instructions} className="text-sm block" />
                  </div>
                </div>
              )}

              {mine.has(selected.id) ? (
                <Button disabled variant="secondary" className="w-full">Already submitted</Button>
              ) : selected.publisher_id === session?.user?.id ? (
                <Button disabled variant="secondary" className="w-full">This is your own task</Button>
              ) : !isActive ? (
                <Button className="w-full" variant="secondary" onClick={() => { setSelected(null); setActivationOpen(true); }}>
                  <Lock className="h-4 w-4" /> Submit Task (locked)
                </Button>
              ) : (
                <Button className="w-full bg-gradient-to-r from-primary to-primary/80" onClick={openSubmit}>
                  Submit & Earn ৳{Number(selected.reward).toFixed(2)}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submission modal */}
      {selected && (
        <SubmissionDialog
          task={selected}
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          onSuccess={() => { setSubmitOpen(false); setSelected(null); load(); }}
        />
      )}
    </>
  );
}

function SubmissionDialog({ task, open, onOpenChange, onSuccess }: {
  task: any; open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [values, setValues] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const proofFields: ProofField[] = (task.proof_fields as ProofField[])?.length
    ? task.proof_fields
    : [{ id: "legacy", type: task.proof_type ?? "image", label: task.proof_type === "text" ? "Your proof" : "Screenshot", required: true }];

  useEffect(() => { if (open) { setValues({}); setFiles({}); setNote(""); } }, [open]);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    // Validate
    for (const f of proofFields) {
      if (!f.required) continue;
      if (f.type === "image") { if (!files[f.id]) { toast.error(`Please upload "${f.label}"`); return; } }
      else { if (!values[f.id] || String(values[f.id]).trim() === "") { toast.error(`Please fill "${f.label}"`); return; } }
      if (f.type === "link" && values[f.id]) {
        try { new URL(values[f.id]); } catch { toast.error(`"${f.label}" must be a valid URL`); return; }
      }
    }

    setBusy(true);
    try {
      const fieldsText = proofFields
        .filter(f => f.type !== "image" && values[f.id])
        .map(f => `${f.label}: ${values[f.id]}`).join("\n");
      const noteText = note.trim() ? `Note: ${note.trim()}` : "";
      const proofText = [fieldsText, noteText].filter(Boolean).join("\n\n");

      const { data: sub, error: subErr } = await supabase.from("task_submissions").insert({
        task_id: task.id, user_id: session.user.id, status: "pending",
        proof_text: proofText || null,
      }).select().single();

      if (subErr) throw subErr;

      const uploadedPaths: string[] = [];
      try {
        for (const f of proofFields) {
          if (f.type !== "image" || !files[f.id]) continue;
          const file = files[f.id];
          if (file.size > 5 * 1024 * 1024) throw new Error("Each image must be under 5MB");
          if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${session.user.id}/${sub.id}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage.from("proofs").upload(path, file, {
            contentType: file.type,
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

      // Notify publisher
      if (task.publisher_id) {
        await supabase.from("notifications").insert({
          user_id: task.publisher_id,
          title: "New submission",
          message: `A user submitted proof for "${task.title}".`,
          type: "submission_new",
        });
      }

      toast.success("Submission sent! Awaiting publisher review.");
      onSuccess();
    } catch (err: any) {
      toast.error(friendlyError(err, "Submission failed"));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit proof — {task.title}</DialogTitle>
          <DialogDescription>Complete all required fields below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {proofFields.map((f) => (
            <div key={f.id} className="space-y-2">
              <Label>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
              {f.type === "text" && (
                <Textarea rows={3} value={values[f.id] ?? ""}
                  onChange={(e) => setValues(v => ({ ...v, [f.id]: e.target.value }))} maxLength={1000} />
              )}
              {f.type === "link" && (
                <Input type="url" placeholder="https://…" value={values[f.id] ?? ""}
                  onChange={(e) => setValues(v => ({ ...v, [f.id]: e.target.value }))} maxLength={500} />
              )}
              {f.type === "username" && (
                <Input placeholder="@username or ID" value={values[f.id] ?? ""}
                  onChange={(e) => setValues(v => ({ ...v, [f.id]: e.target.value }))} maxLength={100} />
              )}
              {f.type === "image" && (
                <div className="border-2 border-dashed border-border rounded-lg p-3">
                  {files[f.id] ? (
                    <div className="relative">
                      <img src={URL.createObjectURL(files[f.id])} alt="" className="w-full max-h-40 object-cover rounded" />
                      <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => setFiles(p => { const n = { ...p }; delete n[f.id]; return n; })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
                        setFiles(p => ({ ...p, [f.id]: file }));
                      }} className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="space-y-2">
            <Label>Message to publisher <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
              placeholder="Add any notes, comments, or extra context for the publisher…" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-primary to-primary/80">
            {busy ? "Submitting…" : `Submit & earn ৳${Number(task.reward).toFixed(2)}`}
          </Button>
        </form>

      </DialogContent>
    </Dialog>
  );
}
