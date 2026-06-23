import Database from "better-sqlite3";

const createMockDb = () => {
  const db = new Database(":memory:");

  return {
    execSync: (sql: string) => {
      db.exec(sql);
    },
    runSync: (sql: string, ...params: unknown[]) => {
      db.prepare(sql).run(...params);
    },
    getAllSync: (sql: string, ...params: unknown[]): unknown[] => {
      return db.prepare(sql).all(...params);
    },
    getFirstSync: (sql: string, ...params: unknown[]): unknown | null => {
      return db.prepare(sql).get(...params) ?? null;
    },
    closeSync: () => {
      db.close();
    },
  };
};

export const openDatabaseSync = jest.fn((_name: string) => createMockDb());
