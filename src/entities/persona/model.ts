export type Persona = {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
};

export type PersonaRow = {
  id: string;
  name: string;
  system_prompt: string;
  created_at: number;
  updated_at: number;
};

export function rowToPersona(row: PersonaRow): Persona {
  return {
    id: row.id,
    name: row.name,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
