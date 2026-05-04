import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/lib/db";
import { getRequiredEnv } from "@/lib/env";

export const spotifyScopes = [
  "user-read-private",
  "user-library-read",
  "user-library-modify",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
];

function createAuth() {
  const baseUrl = getRequiredEnv("BETTER_AUTH_URL");

  return betterAuth({
    appName: "OneMusicCrate",
    baseURL: baseUrl,
    secret: getRequiredEnv("BETTER_AUTH_SECRET"),
    trustedOrigins: [new URL(baseUrl).origin],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
    }),
    plugins: [nextCookies()],
    socialProviders: {
      spotify: {
        clientId: getRequiredEnv("SPOTIFY_CLIENT_ID"),
        clientSecret: getRequiredEnv("SPOTIFY_CLIENT_SECRET"),
        scope: spotifyScopes,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
}

type AppAuth = ReturnType<typeof createAuth>;

let authInstance: AppAuth | null = null;

export function getAuth(): AppAuth {
  if (authInstance) {
    return authInstance;
  }

  const initializedAuth = createAuth();

  authInstance = initializedAuth;

  return initializedAuth;
}
