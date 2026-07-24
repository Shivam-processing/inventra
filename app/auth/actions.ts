"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
};

const emailSchema = z.string().trim().toLowerCase().email().max(320);
const nameSchema = z.string().trim().min(1).max(120);

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  if (!emailSchema.safeParse(email).success || !password || password.length > 1024) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const full_name = String(formData.get("fullName") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const { email, password } = readCredentials(formData);

  if (!nameSchema.safeParse(full_name).success || !emailSchema.safeParse(email).success || !password) {
    return { error: "Complete all required fields." };
  }

  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (password.length > 1024) {
    return { error: "Your password is too long." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
      },
    },
  });

  if (error || !data.user) {
    return { error: "Unable to create your account. Check the details and try again." };
  }

  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    await supabase.auth.signOut();
  }

  redirect("/login");
}
