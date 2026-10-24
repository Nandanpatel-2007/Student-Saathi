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
