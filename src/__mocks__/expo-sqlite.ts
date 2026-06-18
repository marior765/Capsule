const createMockDb = () => {
  const rows: Record<string, unknown[]> = {};

  return {
    execSync: jest.fn(),
    runSync: jest.fn(),
    getAllSync: jest.fn((sql: string): unknown[] => {
      const table = Object.keys(rows).find((t) => sql.includes(t));
      return table ? rows[table] : [];
    }),
    getFirstSync: jest.fn((sql: string): unknown | null => {
      const table = Object.keys(rows).find((t) => sql.includes(t));
      return table ? (rows[table][0] ?? null) : null;
    }),
    closeSync: jest.fn(),
    _rows: rows,
  };
};

export const openDatabaseSync = jest.fn(() => createMockDb());
