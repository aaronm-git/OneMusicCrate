import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestampColumn = (name: string) =>
  timestamp(name, {
    mode: "date",
    withTimezone: true,
  });

export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    expiresAt: timestampColumn("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
  ]
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestampColumn("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestampColumn("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId
    ),
    index("account_user_id_idx").on(table.userId),
  ]
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestampColumn("expiresAt").notNull(),
    createdAt: timestampColumn("createdAt").notNull().defaultNow(),
    updatedAt: timestampColumn("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const authSchema = {
  users,
  sessions,
  accounts,
  verifications,
};

export const betterAuthSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
};
