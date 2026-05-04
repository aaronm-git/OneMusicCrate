import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredEnv } from "@/lib/env";
import { authSchema } from "@/lib/db/schema";

type Database = PostgresJsDatabase<typeof authSchema>;

let databaseClient: postgres.Sql | null = null;
let database: Database | null = null;

function getSqlClient() {
  if (!databaseClient) {
    databaseClient = postgres(getRequiredEnv("DATABASE_URL"), {
      prepare: false,
    });
  }

  return databaseClient;
}

export function getDb() {
  if (!database) {
    database = drizzle(getSqlClient(), {
      schema: authSchema,
    });
  }

  return database;
}
