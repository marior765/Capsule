import "@/shared/ui/unistyles";

import { useEffect, type PropsWithChildren } from "react";
import { openDb, runMigrations } from "@/shared/db";

export function Providers({ children }: PropsWithChildren) {
  useEffect(() => {
    const db = openDb();
    runMigrations(db);
  }, []);

  return <>{children}</>;
}
