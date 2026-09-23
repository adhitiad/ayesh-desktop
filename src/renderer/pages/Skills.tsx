import React, { useEffect, useState } from 'react';

interface Skill {
  name: string;
  description: string;
  installed: boolean;
}

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    (window as any).ayesh.listSkills().then((s: Skill[]) => setSkills(s));
  }, []);

  return (
    <div className="skills-page">
      <h2>Skills</h2>
      <ul>
        {skills.map((skill, i) => (
          <li key={i}>
            <strong>{skill.name}</strong>: {skill.description}
            {skill.installed ? ' ✅' : ' ❌'}
          </li>
        ))}
      </ul>
    </div>
  );
}
