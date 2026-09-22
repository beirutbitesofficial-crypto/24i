"use client";

import { useEffect, useMemo, useState } from "react";

type ClientOption = { id: string; brandName: string };
type Mapping = { id: string; clientId: string; channelId: string; service: string; name: string | null; autoPublish: boolean };
type BufferChannel = { id: string; name: string; service: string };
type BufferGroup = { organization: { id: string; name: string }; channels: BufferChannel[] };

export function SocialPublishingSettings({
  clients,
  initialMappings,
  configured,
  ar = false,
}: {
  clients: ClientOption[];
  initialMappings: Mapping[];
  configured: boolean;
  ar?: boolean;
}) {
  const [groups, setGroups] = useState<BufferGroup[]>([]);
  const [mappings, setMappings] = useState(initialMappings);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(configured);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const channels = useMemo(() => groups.flatMap((group) => group.channels
    .filter((channel) => ["instagram", "facebook", "tiktok"].includes(channel.service.toLowerCase()))
    .map((channel) => ({
      ...channel,
      organizationName: group.organization.name,
    }))), [groups]);

  useEffect(() => {
    setSelected(new Set(mappings.filter((item) => item.clientId === clientId && item.autoPublish).map((item) => item.channelId)));
  }, [clientId, mappings]);

  useEffect(() => {
    if (!configured) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/social/buffer/channels", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load Buffer channels");
        setGroups(data.groups || []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load Buffer channels");
      } finally {
        setLoading(false);
      }
    })();
  }, [configured]);

  function toggle(channelId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(channelId)) next.delete(channelId); else next.add(channelId);
      return next;
    });
  }

  async function save() {
    if (!clientId) return;
    setBusy(true);
    setMessage("");
    try {
      const chosen = channels.filter((channel) => selected.has(channel.id));
      const res = await fetch("/api/social/channels", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          mappings: chosen.map((channel) => ({
            channelId: channel.id,
            service: channel.service,
            name: channel.name,
            autoPublish: true,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save social channels");

      setMappings((current) => [
        ...current.filter((item) => item.clientId !== clientId),
        ...chosen.map((channel) => ({
          id: channel.id,
          clientId,
          channelId: channel.id,
          service: channel.service,
          name: channel.name,
          autoPublish: true,
        })),
      ]);
      setMessage(ar ? "تم حفظ قنوات النشر التلقائي." : "Auto-publishing channels saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ar ? "تعذّر الحفظ." : "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <div className="section-head">
      <div>
        <span className="eyebrow">AUTO PUBLISH</span>
        <h2>{ar ? "النشر التلقائي بعد موافقة العميل" : "Publish automatically after client approval"}</h2>
      </div>
      <span className="muted">Buffer</span>
    </div>

    {!configured ? <div className="notice">
      {ar
        ? "أضف BUFFER_API_KEY داخل Environment Variables على Hostinger، وبعدها أعد النشر."
        : "Add BUFFER_API_KEY in Hostinger Environment Variables, then redeploy."}
    </div> : <>
      {message && <div className="notice">{message}</div>}
      <p className="muted">
        {ar
          ? "اختار العميل، وبعدها القنوات التي يجب أن ينزل عليها المحتوى فور موافقته."
          : "Choose a client, then select the Instagram, Facebook and TikTok channels that should publish immediately after approval."}
      </p>

      <div className="compact-form">
        <label>{ar ? "العميل" : "Client"}
          <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.brandName}</option>)}
          </select>
        </label>

        {loading ? <p className="muted">{ar ? "جارٍ تحميل قنوات Buffer…" : "Loading Buffer channels…"}</p> : (
          <div className="client-checks">
            {channels.length ? channels.map((channel) => <label className="check" key={channel.id}>
              <input type="checkbox" checked={selected.has(channel.id)} onChange={() => toggle(channel.id)} />
              <span><b>{channel.name}</b><small>{channel.service} · {channel.organizationName}</small></span>
            </label>) : <p className="muted">{ar ? "ما في قنوات متاحة بحساب Buffer." : "No Buffer channels available."}</p>}
          </div>
        )}

        <button type="button" disabled={busy || loading || !clientId} onClick={() => void save()}>
          {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ قنوات النشر" : "Save publishing channels")}
        </button>
      </div>
    </>}
  </section>;
}
