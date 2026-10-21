"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({ user: { role: { type: "string", required: false, input: false } } })],
});

export const { useSession, signOut } = authClient;
