import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Edit2, X, Check, FileText } from "lucide-react";

interface Skill {
  name: string;
  path: string;
  description?: string;
  scope: "project" | "global";
}

const DEFAULT_SKILL_TEMPLATE = `# Skill Name

Description of what this skill does and when to use it.
`;

export function SkillManager({ projectPath }: { projectPath?: string | null }) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillScope, setNewSkillScope] = useState<"project" | "global">("project");
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // The skills IPC is stateful — point it at the active project (or
      // global-only when none is open) before listing.
      await window.pilot.skills.init(projectPath ?? null);
      const result = await window.pilot.skills.list();
      if (result.success) {
        setSkills((result.skills ?? []) as Skill[]);
      } else {
        setError(result.error || t("settings.skills.error.load"));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleCreate = async () => {
    if (!newSkillName.trim()) return;
    setError(null);
    try {
      const result = await window.pilot.skills.create({
        name: newSkillName.trim(),
        content: DEFAULT_SKILL_TEMPLATE.replace("Skill Name", newSkillName.trim()),
        scope: newSkillScope,
      });
      if (result.success) {
        setNewSkillName("");
        setIsCreating(false);
        await loadSkills();
      } else {
        setError(result.error || t("settings.skills.error.create"));
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDelete = async (skillPath: string) => {
    if (!confirm(t("settings.skills.confirmDelete"))) return;
    setError(null);
    try {
      const result = await window.pilot.skills.delete(skillPath);
      if (result.success) {
        await loadSkills();
      } else {
        setError(result.error || t("settings.skills.error.delete"));
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleEdit = async (skillPath: string) => {
    try {
      const result = await window.pilot.skills.read(skillPath);
      if (result.success) {
        setEditContent(result.content ?? "");
        setEditingPath(skillPath);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSave = async () => {
    if (!editingPath) return;
    setError(null);
    try {
      const result = await window.pilot.skills.update({
        skillPath: editingPath,
        content: editContent,
      });
      if (result.success) {
        setEditingPath(null);
        setEditContent("");
        await loadSkills();
      } else {
        setError(result.error || t("settings.skills.error.save"));
      }
    } catch (err) {
      setError(String(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading skills...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t("settings.skills.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("settings.skills.description")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("settings.skills.add")}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Create new skill form */}
      {isCreating && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-medium">{t("settings.skills.createTitle")}</h4>
          <Input
            placeholder={t("settings.skills.namePlaceholder")}
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={newSkillScope === "project" ? "default" : "outline"}
              onClick={() => setNewSkillScope("project")}
            >
              {t("settings.skills.scopeProject")}
            </Button>
            <Button
              size="sm"
              variant={newSkillScope === "global" ? "default" : "outline"}
              onClick={() => setNewSkillScope("global")}
            >
              {t("settings.skills.scopeGlobal")}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>
              <Check className="w-4 h-4 mr-2" />
              {t("settings.skills.create")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsCreating(false);
                setNewSkillName("");
              }}
            >
              <X className="w-4 h-4 mr-2" />
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Edit skill form */}
      {editingPath && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h4 className="text-sm font-medium">{t("settings.skills.editTitle")}</h4>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Check className="w-4 h-4 mr-2" />
              {t("settings.skills.save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingPath(null);
                setEditContent("");
              }}
            >
              <X className="w-4 h-4 mr-2" />
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Skills list */}
      {skills.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 flex flex-col items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {t("settings.skills.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div key={skill.path} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{skill.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {skill.description || t("settings.skills.noDescription")}
                  </p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleEdit(skill.path)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(skill.path)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                  {skill.scope}
                </span>
                <span className="truncate">{skill.path}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
