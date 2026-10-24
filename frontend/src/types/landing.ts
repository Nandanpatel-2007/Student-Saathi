import type { LucideIcon } from 'lucide-react'

export interface NavLink {
  label: string
  href: string
}

export interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

export interface Step {
  icon: LucideIcon
  title: string
  description: string
}

export interface Audience {
  id: string
  title: string
  lead: string
  outcomes: string[]
}

export interface PreviewSubject {
  name: string
  score: number
  low?: boolean
}

export interface LandingContent {
  brand: string
  nav: {
    links: NavLink[]
    login: string
    getStarted: string
  }
  hero: {
    eyebrow: string
    headline: string
    subhead: string
    primaryCta: string
    secondaryCta: string
  }
  features: {
    id: string
    eyebrow: string
    title: string
    intro: string
    items: Feature[]
  }
  how: {
    id: string
    eyebrow: string
    title: string
    intro: string
    steps: Step[]
  }
  preview: {
    eyebrow: string
    title: string
    body: string
    cardTitle: string
    attendanceLabel: string
    attendancePercent: number
    scoresLabel: string
    subjects: PreviewSubject[]
    alert: string
    ariaLabel: string
  }
  audiences: {
    eyebrow: string
    title: string
    items: Audience[]
  }
  cta: {
    title: string
    body: string
    button: string
  }
  footer: {
    copyright: string
  }
}
