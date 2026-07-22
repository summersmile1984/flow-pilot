import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, Check, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LlmProvider } from "@shared/types/llm-provider";

const INPUT_CLASS =
  "h-8 w-full rounded-md border border-foreground/10 bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-foreground/30 focus:ring-1 focus:ring-foreground/20";

interface Draft {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string;
}

function toDraft(p: LlmProvider): Draft {
  return { id: p.id, name: p.name, baseUrl: p.baseUrl, apiKey: p.apiKey, models: p.models.join("\n") };
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `provider-${Date.now()}`;
}

/** Add / edit / delete the saved LLM providers used by the Pilot supervisor. */
export function LlmProviderManager({ onProvidersChange }: { onProvidersChange?: () => void } = {}) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await window.pilot.mastra.listProviders();
    if (res.success) setProviders(res.providers ?? []);
    // res.error is a raw message from the main process — left untranslated on
    // purpose; only our own fallback copy goes through t().
    else setError(res.error ?? t("settings.pilot.provider.error.load"));
  }, [t]);

  useEffect(() => { void reload(); }, [reload]);

  const startAdd = () => {
    setIsNew(true);
    setEditing({ id: "", name: "", baseUrl: "", apiKey: "", models: "" });
  };
  const startEdit = (p: LlmProvider) => {
    setIsNew(false);
    setEditing(toDraft(p));
  };
  const cancel = () => { setEditing(null); setIsNew(false); setError(null); };

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { setError(t("settings.pilot.provider.error.nameRequired")); return; }
    const models = editing.models.split("\n").map((m) => m.trim()).filter(Boolean);
    if (models.length === 0) { setError(t("settings.pilot.provider.error.modelRequired")); return; }
    const provider: LlmProvider = {
      id: editing.id || slugify(name),
      name,
      baseUrl: editing.baseUrl.trim(),
      apiKey: editing.apiKey.trim(),
      models,
    };
    const res = await window.pilot.mastra.saveProvider(provider);
    if (res.success) { setProviders(res.providers ?? []); cancel(); onProvidersChange?.(); }
    else setError(res.error ?? t("settings.pilot.provider.error.save"));
  };

  const remove = async (id: string) => {
    const res = await window.pilot.mastra.deleteProvider(id);
    if (res.success) { setProviders(res.providers ?? []); onProvidersChange?.(); }
    else setError(res.error ?? t("settings.pilot.provider.error.delete"));
  };

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {node}
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="text-xs text-red-500">{error}</div>}

      {providers.map((p) => (
        <div key={p.id} className="rounded-lg border border-foreground/10 bg-background/40 p-3">
          {editing && editing.id === p.id ? (
            <ProviderForm draft={editing} setDraft={setEditing} onSave={save} onCancel={cancel} field={field} />
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.baseUrl || t("settings.pilot.provider.defaultEndpoint")} · {p.apiKey ? t("settings.pilot.provider.keySet") : t("settings.pilot.provider.usesEnv")}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.models.map((m) => (
                    <span key={m} className="rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] text-foreground/70">{m}</span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="xs" variant="ghost" onClick={() => startEdit(p)} className="h-7 gap-1 text-xs">
                  <Pencil className="h-3 w-3" /> {t("settings.pilot.provider.edit")}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => remove(p.id)} className="h-7 gap-1 text-xs text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {isNew && editing && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
          <ProviderForm draft={editing} setDraft={setEditing} onSave={save} onCancel={cancel} field={field} />
        </div>
      )}

      {!editing && (
        <Button size="sm" variant="outline" onClick={startAdd} className="h-8 w-fit gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> {t("settings.pilot.provider.add")}
        </Button>
      )}
    </div>
  );
}

interface ProviderFormProps {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  field: (label: string, node: React.ReactNode, hint?: string) => React.ReactNode;
}

function ProviderForm({ draft, setDraft, onSave, onCancel, field }: ProviderFormProps) {
  const { t } = useTranslation();
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchModels = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await window.pilot.mastra.fetchProviderModels({
        baseUrl: draft.baseUrl,
        apiKey: draft.apiKey,
        providerId: draft.id || undefined,
      });
      if (res.success && res.models) {
        setDraft({ ...draft, models: res.models.join("\n") });
      } else {
        setFetchError(res.error ?? t("settings.pilot.provider.error.fetchModels"));
      }
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Placeholders that are example values (DeepSeek, the endpoint URL, the
          model ids) stay as-is — they illustrate the expected format, not copy. */}
      {field(t("settings.pilot.provider.name"), (
        <input className={INPUT_CLASS} value={draft.name} placeholder="DeepSeek"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      ))}
      {field(t("settings.pilot.provider.baseUrl"), (
        <input className={INPUT_CLASS} value={draft.baseUrl} placeholder="https://api.deepseek.com" spellCheck={false}
          onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} />
      ), t("settings.pilot.provider.baseUrlHint"))}
      {field(t("settings.pilot.provider.apiKey"), (
        <input className={INPUT_CLASS} type="password" value={draft.apiKey} placeholder={t("settings.pilot.provider.apiKeyPlaceholder")} autoComplete="off" spellCheck={false}
          onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} />
      ))}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">{t("settings.pilot.provider.models")}</label>
          <Button size="xs" variant="ghost" disabled={fetching} onClick={fetchModels} className="h-6 gap-1 text-[11px]">
            {fetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {fetching ? t("settings.pilot.provider.fetching") : t("settings.pilot.provider.fetchFromApi")}
          </Button>
        </div>
        <textarea className={`${INPUT_CLASS} h-auto min-h-16 py-1.5`} value={draft.models} placeholder={"deepseek-chat\ndeepseek-reasoner"} spellCheck={false}
          onChange={(e) => setDraft({ ...draft, models: e.target.value })} />
        {fetchError
          ? <span className="text-[10px] text-red-500">{fetchError}</span>
          : <span className="text-[10px] text-muted-foreground">{t("settings.pilot.provider.modelsHint")}</span>}
      </div>
      <div className="flex justify-end gap-2 pt-0.5">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 gap-1 text-xs">
          <X className="h-3.5 w-3.5" /> {t("common.cancel")}
        </Button>
        <Button size="sm" onClick={onSave} className="h-8 gap-1 text-xs">
          <Check className="h-3.5 w-3.5" /> {t("settings.pilot.provider.save")}
        </Button>
      </div>
    </div>
  );
}
