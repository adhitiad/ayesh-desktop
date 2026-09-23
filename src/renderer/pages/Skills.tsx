import React, { useEffect, useState } from 'react';

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
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setSkills(await (window as any).ayesh.listSkills());
      setError('');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setSkills(await (window as any).ayesh.listSkills());
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
  }, []);

  const toggle = async (skill: Skill) => {
    setBusy(skill.name);
    setError('');
    try {
      const res: Status = await (window as any).ayesh.installSkill(skill.name, skill.installed);
      if (res && res.success === false) throw new Error(res.message || 'gagal');
      setSkills((prev) =>
        prev.map((s) => (s.name === skill.name ? { ...s, installed: !s.installed } : s))
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
      <button onClick={refresh}>↻ Refresh</button>
      {error && <p style={{ color: '#ff6b6b' }}>⚠️ {error}</p>}
      <ul>
        {skills.map((skill) => (
          <li key={skill.name}>
            <strong>{skill.name}</strong>: {skill.description} {skill.installed ? '✅' : '❌'}{' '}
            <button disabled={busy === skill.name} onClick={() => toggle(skill)}>
              {busy === skill.name ? '…' : skill.installed ? 'Uninstall' : 'Install'}
            </button>
          </li>
        ))}
      </ul>
      {skills.length === 0 && !error && <p>Belum ada skill.</p>}
    </div>
  );
}
