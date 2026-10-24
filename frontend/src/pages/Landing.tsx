import { Audiences } from '../components/Audiences'
import { CtaBand } from '../components/CtaBand'
import { DashboardPreview } from '../components/DashboardPreview'
import { Features } from '../components/Features'
import { Footer } from '../components/Footer'
import { Hero } from '../components/Hero'
import { HowItWorks } from '../components/HowItWorks'
import { Navbar } from '../components/Navbar'

export function Landing() {
  return (
    <div id="top" className="overflow-x-clip">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <DashboardPreview />
        <Audiences />
        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
