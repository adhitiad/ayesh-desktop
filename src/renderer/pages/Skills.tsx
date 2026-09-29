import React, { useEffect, useState } from "react";

interface Skill {
  name: string;
  description: string;
  installed: boolean;
}

interface Status {
  success: boolean;
  message: string;
}

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setSkills(await (window as any).ayesh.listSkills());
      setError("");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (window as any).ayesh
      .listSkills()
      .then((list: Skill[]) => {
        if (!alive) return;
        setSkills(list);
        setError("");
      })
      .catch((e: any) => {
        if (alive) setError(e?.message || String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (skill: Skill) => {
    setBusy(skill.name);
    setError("");
    try {
      const res: Status = await (window as any).ayesh.installSkill(
        skill.name,
        skill.installed,
      );
      if (res && res.success === false) throw new Error(res.message || "gagal");
      setSkills((prev) =>
        prev.map((s) =>
          s.name === skill.name ? { ...s, installed: !s.installed } : s,
        ),
      );
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="skills-page">
      <h2>Skills</h2>
      <button
        onClick={() => {
          setLoading(true);
          void refresh();
        }}
      >
        Muat ulang
      </button>
      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      <ul>
        {skills.map((skill) => (
          <li key={skill.name}>
            <strong>{skill.name}</strong>: {skill.description}{" "}
            <span className={`tag ${skill.installed ? "on" : ""}`}>
              {skill.installed ? "terpasang" : "belum"}
            </span>{" "}
            <button
              disabled={busy === skill.name}
              onClick={() => toggle(skill)}
            >
              {busy === skill.name
                ? "…"
                : skill.installed
                  ? "Uninstall"
                  : "Install"}
            </button>
          </li>
        ))}
      </ul>
      {loading && skills.length === 0 && !error && (
        <p>Memuat daftar skill...</p>
      )}
      {skills.length === 0 && !error && !loading && (
        <p className="page-empty">
          Belum ada skill terdaftar di server. Periksa konfigurasi backend lalu
          klik Muat ulang.
        </p>
      )}
    </div>
  );
}
