import {
  BookOpen,
  CalendarCheck,
  Calculator,
  ChartColumn,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  Percent,
  PenLine,
  Users,
} from 'lucide-react'

import type { LandingContent } from '../types/landing'

export const landing: LandingContent = {
  brand: 'Student Saathi',

  nav: {
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'For students', href: '#for-students' },
      { label: 'For faculty', href: '#for-faculty' },
    ],
    login: 'Log in',
    getStarted: 'Get started',
  },

  hero: {
    eyebrow: 'Attendance and academic performance tracker',
    headline: 'Attendance and grades, finally in one place.',
    subhead: 'Record classes, enter marks and see every student’s progress as it happens.',
    primaryCta: 'Get started',
    secondaryCta: 'See how it works',
  },

  features: {
    id: 'features',
    eyebrow: 'Features',
    title: 'Everything a semester needs, nothing it doesn’t.',
    intro: 'One system for the people who teach and the people who learn.',
    items: [
      {
        icon: Users,
        title: 'Student and faculty login',
        description: 'Each person signs in to a view built for their role, with access limited to their own classes.',
      },
      {
        icon: BookOpen,
        title: 'Subjects and sections',
        description: 'Organise subjects, sections and teaching assignments, and enrol a whole section in one step.',
      },
      {
        icon: CalendarCheck,
        title: 'Attendance recording',
        description: 'Start a class session with everyone marked present, then change only the exceptions.',
      },
      {
        icon: PenLine,
        title: 'Assessment marks',
        description: 'Enter quiz, midterm and assignment marks in bulk, with weightage checked for you.',
      },
      {
        icon: Percent,
        title: 'Attendance % and subject-wise performance',
        description: 'Attendance and weighted scores per subject, plus how far you are from the minimum.',
      },
      {
        icon: ChartColumn,
        title: 'Charts and alerts',
        description: 'Clear charts and early warnings for low attendance, failing subjects and sharp score drops.',
      },
    ],
  },

  how: {
    id: 'how-it-works',
    eyebrow: 'How it works',
    title: 'From the first class to the final dashboard.',
    intro: 'Five steps, and the numbers take care of themselves.',
    steps: [
      {
        icon: LogIn,
        title: 'Login',
        description: 'Students and faculty sign in with their own accounts.',
      },
      {
        icon: BookOpen,
        title: 'Select Subject',
        description: 'Faculty open the subject and section they teach.',
      },
      {
        icon: ClipboardCheck,
        title: 'Record Attendance / Marks',
        description: 'Mark who attended and enter assessment marks in bulk.',
      },
      {
        icon: Calculator,
        title: 'Calculate Statistics',
        description: 'Percentages, weighted scores and alerts are worked out automatically.',
      },
      {
        icon: LayoutDashboard,
        title: 'View Student Dashboard',
        description: 'Students see attendance, scores and warnings at a glance.',
      },
    ],
  },

  preview: {
    eyebrow: 'Dashboard preview',
    title: 'See where you stand, at a glance.',
    body: 'Attendance and scores sit side by side, and anything that needs attention is flagged before it becomes a problem.',
    cardTitle: 'My dashboard',
    attendanceLabel: 'Overall attendance',
    attendancePercent: 82,
    scoresLabel: 'Subject scores',
    subjects: [
      { name: 'Maths', score: 78 },
      { name: 'Physics', score: 64, low: true },
      { name: 'Chem', score: 71 },
      { name: 'English', score: 88 },
      { name: 'CS', score: 92 },
    ],
    alert: 'Attendance below 75% in Physics',
    ariaLabel:
      'Illustrative dashboard: overall attendance 82 percent, subject scores for five subjects, and a warning that attendance in Physics is below 75 percent.',
  },

  audiences: {
    eyebrow: 'Who it’s for',
    title: 'Clear outcomes for both sides of the classroom.',
    items: [
      {
        id: 'for-students',
        title: 'For students',
        lead: 'Know where you stand while there is still time to act.',
        outcomes: [
          'See your attendance in every subject, and how many classes you need to reach the minimum.',
          'Follow weighted scores and compare with the class average without seeing anyone else’s marks.',
          'Get early alerts for low attendance or a sudden drop in results.',
        ],
      },
      {
        id: 'for-faculty',
        title: 'For faculty',
        lead: 'Spend less time on registers and more time teaching.',
        outcomes: [
          'Record a whole class’s attendance in moments, then adjust just the exceptions.',
          'Enter marks once and let percentages and weighted scores update themselves.',
          'Spot at-risk students early and export class sheets as CSV.',
        ],
      },
    ],
  },

  cta: {
    title: 'Ready to see your semester clearly?',
    body: 'Sign in and have attendance and performance in one place from day one.',
    button: 'Get started',
  },

  footer: {
    copyright: 'Student Saathi',
  },
}
