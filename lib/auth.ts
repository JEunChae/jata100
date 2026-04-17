import { createClient } from './supabase/client'

export function buildEmail(username: string): string {
  return `${username}@jata100.app`
}

export function parseUsername(email: string): string {
  return email.replace('@jata100.app', '')
}

export async function loginOrCreate(
  username: string,
  password: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const email = buildEmail(username)

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (!signInError) return { error: null }

  // User doesn't exist — create account
  if (signInError.message.includes('Invalid login credentials')) {
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })
    if (signUpError) return { error: signUpError.message }
    return { error: null }
  }

  return { error: signInError.message }
}

export async function logout(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}
