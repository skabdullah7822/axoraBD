import { useEffect, useMemo, useState } from "react";
import { Paginator } from "@/components/paginator";
const PAGE_SIZE = 25;
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, Trash2, Pencil, Send, Bell, Megaphone, Plus, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { fmtDate, EmptyState } from "@/lib/admin-utils";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/skabdullah_999_sg/admin/notifications")({
  head: () => ({ meta: [{ title: "Admin Notifications — AxoraBD" }] }),
  component: NotificationsPage,
});

type Tab = "admin" | "history" | "compose";

async function withNotificationUsers(rows: any[]) {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  if (!userIds.length) return rows;
  const { data: profiles } = await supabase.from("profiles").select("user_id,username").in("user_id", userIds);
  const byUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return rows.map((r) => ({ ...r, user: byUserId.get(r.user_id) ?? null }));
}

function NotificationsPage() {
  return (
    <AdminShell title="Notifications Center">
      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin"><Bell className="h-4 w-4 mr-1" />Admin Inbox</TabsTrigger>
          <TabsTrigger value="compose"><Send className="h-4 w-4 mr-1" />Send Notification</TabsTrigger>
          <TabsTrigger value="notice"><Megaphone className="h-4 w-4 mr-1" />Notice Board</TabsTrigger>
          <TabsTrigger value="history">Sent History</TabsTrigger>
        </TabsList>
        <TabsContent value="admin"><AdminInbox /></TabsContent>
        <TabsContent value="compose"><ComposePanel /></TabsContent>
        <TabsContent value="notice"><NoticeBoardPanel /></TabsContent>
        <TabsContent value="history"><HistoryPanel /></TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function NoticeBoardPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("notice_board").select("*")
      .order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notice-admin-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "notice_board" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const openNew = () => { setEdit({ title: "", body: "", type: "info", active: true }); setCreating(true); };
  const openEdit = (r: any) => { setEdit({ ...r }); setCreating(false); };

  const save = async () => {
    if (!edit?.title?.trim() || !edit?.body?.trim()) { toast.error("Title and body required"); return; }
    if (creating) {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("notice_board").insert({
        title: edit.title, body: edit.body, type: edit.type, active: edit.active, created_by: u.user?.id ?? null,
      });
      if (error) return toast.error(friendlyError(error));
      toast.success("Notice posted");
    } else {
      const { error } = await supabase.from("notice_board").update({
        title: edit.title, body: edit.body, type: edit.type, active: edit.active,
      }).eq("id", edit.id);
      if (error) return toast.error(friendlyError(error));
      toast.success("Updated");
    }
    setEdit(null);
  };

  const toggleActive = async (r: any) => {
    await supabase.from("notice_board").update({ active: !r.active }).eq("id", r.id);
  };
  const del = async (id: string) => {
    if (!confirm("Delete this notice?")) return;
    await supabase.from("notice_board").delete().eq("id", id);
    toast.success("Deleted");
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">Notices appear on every user's dashboard.</p>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />New Notice</Button>
      </div>
      <Card><CardContent className="p-0">
        {rows.length === 0 ? <EmptyState message="No notices yet." /> : (
          <div className="divide-y divide-border">
            {rows.map(r => (
              <div key={r.id} className={`p-4 flex items-start gap-4 ${r.active ? "" : "opacity-60"}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{r.type}</span>
                    {!r.active && <span className="text-[10px] uppercase font-semibold text-muted-foreground">HIDDEN</span>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.body}</div>
                  <div className="text-xs text-muted-foreground mt-1">{fmtDate(r.created_at)}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => toggleActive(r)}>
                    {r.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => del(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{creating ? "New notice" : "Edit notice"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {["info", "success", "warning", "error"].map(t => (
                    <Button key={t} size="sm" variant={edit.type === t ? "default" : "secondary"} onClick={() => setEdit({ ...edit, type: t })}>{t}</Button>
                  ))}
                </div>
              </div>
              <div><Label>Body</Label><Textarea rows={5} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={!!edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} />
                <Label>Active (visible to users)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save}>{creating ? "Post" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DuplicateIpWarningPanel() {
  const [enabled, setEnabled] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings")
        .select("duplicate_ip_warning_enabled,duplicate_ip_warning_title,duplicate_ip_warning_message")
        .limit(1).maybeSingle();
      if (data) {
        setEnabled(!!data.duplicate_ip_warning_enabled);
        setTitle(data.duplicate_ip_warning_title ?? "");
        setMessage(data.duplicate_ip_warning_message ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message required"); return; }
    setSaving(true);
    const { data: row } = await supabase.from("settings").select("id").limit(1).maybeSingle();
    if (!row?.id) { toast.error("Settings row missing"); setSaving(false); return; }
    const { error } = await supabase.from("settings").update({
      duplicate_ip_warning_enabled: enabled,
      duplicate_ip_warning_title: title,
      duplicate_ip_warning_message: message,
    }).eq("id", row.id);
    setSaving(false);
    if (error) toast.error(friendlyError(error)); else toast.success("Saved");
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Duplicate-IP auto warning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          When a new user signs up from an IP that already has another account, this warning notification is automatically sent to them.
        </p>
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Label>Enable auto warning</Label>
        </div>
        <div><Label>Warning title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Warning message</Label><Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </CardContent>
    </Card>
  );
}


function AdminInbox() {
  const [rows, setRows] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>("all");
  const [edit, setEdit] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filter]);
  const paged = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);


  const load = async () => {
    const [{ data: unread }, { data }] = await Promise.all([
      supabase.from("notifications").select("type").eq("admin_targeted", true).eq("read", false),
      (filter === "all"
        ? supabase.from("notifications").select("*").eq("admin_targeted", true)
        : supabase.from("notifications").select("*").eq("admin_targeted", true).eq("type", filter)
      ).order("created_at", { ascending: false }).limit(300),
    ]);
    const counts: Record<string, number> = {};
    for (const row of unread ?? []) counts[row.type] = (counts[row.type] ?? 0) + 1;
    setUnreadCounts(counts);
    setRows(await withNotificationUsers(data ?? []));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notif-admin-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [filter]);

  const toggleRead = async (r: any) => {
    await supabase.from("notifications").update({ read: !r.read }).eq("id", r.id);
  };
  const del = async (id: string) => {
    if (!confirm("Delete this notification?")) return;
    await supabase.from("notifications").delete().eq("id", id);
    toast.success("Deleted");
  };
  const saveEdit = async () => {
    if (!edit) return;
    const { error } = await supabase.from("notifications")
      .update({ title: edit.title, message: edit.message, type: edit.type })
      .eq("id", edit.id);
    if (error) toast.error(friendlyError(error));
    else { toast.success("Updated"); setEdit(null); }
  };

  return (
    <div className="mt-4 space-y-4">
      <DuplicateIpWarningPanel />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {["all", "appeal", "payment", "system", "warning", "error", "duplicate_ip"].map(f => {
          const count = f === "all"
            ? Object.values(unreadCounts).reduce((sum, value) => sum + value, 0)
            : unreadCounts[f] ?? 0;
          return (
            <Button key={f} size="sm" variant={filter === f ? "default" : "secondary"} onClick={() => setFilter(f)}>
              {f}
              {count > 0 && <span className="ml-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none text-destructive-foreground">{count > 99 ? "99+" : count}</span>}
            </Button>
          );
        })}
      </div>
      <Card><CardContent className="p-0">
        {rows.length === 0 ? <EmptyState message="No admin notifications." /> : (
          <div className="divide-y divide-border">
            {paged.map(r => (
              <div key={r.id} className={`p-4 flex items-start gap-4 ${r.read ? "" : "bg-primary/5"}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{r.type}</span>
                    {!r.read && <span className="text-[10px] uppercase font-semibold text-primary">NEW</span>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{r.message}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.user?.username ? `To: ${r.user.username} · ` : ""}{fmtDate(r.created_at)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => toggleRead(r)}>
                    <Check className="h-4 w-4 mr-1" />{r.read ? "Unread" : "Read"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEdit({ ...r })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => del(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
      <Paginator page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />


      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit notification</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div><Label>Type</Label><Input value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} /></div>
              <div><Label>Message</Label><Textarea rows={4} value={edit.message} onChange={(e) => setEdit({ ...edit, message: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComposePanel() {
  const [mode, setMode] = useState<"user" | "global">("user");
  const [target, setTarget] = useState(""); // username or user id
  const [type, setType] = useState("system");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return; }
    setSending(true);
    try {
      if (mode === "user") {
        if (!target.trim()) { toast.error("Enter a username or user ID"); return; }
        // Resolve target: accept auth user ID, profile ID, or username
        let userId: string | null = null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(target.trim());
        if (isUuid) {
          const { data } = await supabase.from("profiles").select("user_id").or(`user_id.eq.${target.trim()},id.eq.${target.trim()}`).maybeSingle();
          if (data && !data.user_id) { toast.error("This profile has no login user ID"); return; }
          userId = data?.user_id ?? target.trim();
        }
        if (!userId) {
          const { data } = await supabase.from("profiles").select("user_id").eq("username", target.trim()).maybeSingle();
          userId = data?.user_id ?? null;
        }
        if (!userId) { toast.error("User not found"); return; }
        const { error } = await supabase.from("notifications").insert({ user_id: userId, type, title, message });
        if (error) throw error;
        toast.success("Notification sent");
      } else {
        // Global: insert one row per active user
        const { data: users } = await supabase.from("profiles").select("user_id").eq("status", "active").not("user_id", "is", null);
        if (!users?.length) { toast.error("No active users"); return; }
        const rows = users.map(u => ({ user_id: u.user_id, type, title, message }));
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) throw error;
        toast.success(`Sent to ${users.length} users`);
      }
      setTitle(""); setMessage(""); setTarget("");
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally { setSending(false); }
  };

  return (
    <Card className="mt-4 max-w-2xl">
      <CardHeader><CardTitle>Compose notification</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button size="sm" variant={mode === "user" ? "default" : "secondary"} onClick={() => setMode("user")}>To specific user</Button>
          <Button size="sm" variant={mode === "global" ? "default" : "secondary"} onClick={() => setMode("global")}>Global (all active users)</Button>
        </div>
        {mode === "user" && (
          <div>
            <Label>Username or User ID</Label>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. john_doe or uuid…" />
          </div>
        )}
        <div>
          <Label>Type</Label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {["system", "info", "success", "warning", "error", "payment", "appeal"].map(t => (
              <Button key={t} size="sm" variant={type === t ? "default" : "secondary"} onClick={() => setType(t)}>{t}</Button>
            ))}
          </div>
        </div>
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Message</Label><Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <Button onClick={send} disabled={sending}>
          <Send className="h-4 w-4 mr-1" />{sending ? "Sending…" : "Send"}
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const paged = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);

  const load = async () => {
    const { data } = await supabase.from("notifications")
      .select("*")
      .order("created_at", { ascending: false }).limit(500);
    setRows(await withNotificationUsers(data ?? []));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notif-history-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const del = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("notifications").delete().eq("id", id);
  };

  return (
    <Card className="mt-4"><CardContent className="p-0">
      {rows.length === 0 ? <EmptyState message="No notifications." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Recipient</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Message</th>
                <th className="text-left px-4 py-3">Sent</th>
                <th className="text-left px-4 py-3">Read</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-4 py-3">{r.user?.username ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{r.type}</td>
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{r.message}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3">{r.read ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="destructive" onClick={() => del(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
    <div className="p-3">
      <Paginator page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
    </div>
    </Card>
  );
}
