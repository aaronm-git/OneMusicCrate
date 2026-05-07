import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

import { getDb } from "@/lib/db";
import { betterAuthSchema } from "@/lib/db/schema";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

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
      schema: betterAuthSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["spotify"],
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const resendApiKey = getOptionalEnv("RESEND_API_KEY");
          const emailFrom = getOptionalEnv("AUTH_EMAIL_FROM");

          if (process.env.NODE_ENV === "development") {
            console.info(`[OneMusicCrate] Magic link for ${email}: ${url}`);
          }

          if (!resendApiKey || !emailFrom) {
            if (process.env.NODE_ENV === "development") {
              console.info(
                "[OneMusicCrate] Skipped Resend magic-link delivery because RESEND_API_KEY or AUTH_EMAIL_FROM is not configured."
              );
              return;
            }

            throw new Error(
              "Magic-link email delivery is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM."
            );
          }

          const resend = new Resend(resendApiKey);

          await resend.emails.send({
            from: emailFrom,
            to: email,
            subject: "Sign in to OneMusicCrate",
            text: `Use this link to sign in to OneMusicCrate: ${url}`,
          });
        },
      }),
      nextCookies(),
    ],
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
