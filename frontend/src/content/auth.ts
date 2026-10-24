import { GraduationCap, LayoutDashboard, ShieldCheck, type LucideIcon } from 'lucide-react'

import type { Role } from '../types/auth'

export const login = {
  title: 'Welcome back',
  subtitle: 'Sign in to continue to Student Saathi.',
  roleLegend: 'Sign in as',
  usernameLabel: 'Username',
  passwordLabel: 'Password',
  usernameHint: {
    STUDENT: 'e.g. student01',
    FACULTY: 'e.g. faculty1',
    ADMIN: 'e.g. admin',
  } satisfies Record<Role, string>,
  usernameRequired: 'Enter your username.',
  passwordRequired: 'Enter your password.',
  submit: 'Log in',
  submitting: 'Logging in…',
  forgot: 'Forgot password?',
  forgotTooltip: 'Coming soon',
  backHome: 'Back to home',
  devHint: 'Demo: student01 / faculty1 / admin, password demo1234',
}

export const roleHome: Record<Role, { title: string; body: string; icon: LucideIcon }> = {
  STUDENT: {
    title: 'Student dashboard coming soon',
    body: 'Your attendance, scores and alerts will appear here.',
    icon: GraduationCap,
  },
  FACULTY: {
    title: 'Faculty dashboard coming soon',
    body: 'Your classes, attendance sheets and marks entry will appear here.',
    icon: LayoutDashboard,
  },
  ADMIN: {
    title: 'Admin dashboard coming soon',
    body: 'Subjects, sections, enrollments and teaching assignments will be managed here.',
    icon: ShieldCheck,
  },
}
