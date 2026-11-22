import { useState } from 'react'
import {
  ArrowRight, BookOpenCheck, CheckCircle2, ChevronRight, FileCheck2,
  GraduationCap, House, LayoutDashboard, Menu, ShieldCheck,
  UserRound, X,
} from 'lucide-react'
import mitcorerLogo from './assets/mitcorer-logo.png'
import './shadcn.css'
import { Badge } from './components/ui/badge.jsx'
import { Button } from './components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card.jsx'

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'admission', label: 'Admission progress', icon: CheckCircle2 },
  { id: 'programmes', label: 'Programme preferences', icon: GraduationCap },
  { id: 'scholarships', label: 'Scholarship guide', icon: ShieldCheck },
  { id: 'stay', label: 'Stay preference', icon: House },
  { id: 'documents', label: 'Document checklist', icon: FileCheck2 },
]

const overviewCards = [
  { id: 'programmes', title: 'Programme preferences', description: 'Choose an admission route and arrange your programme choices.', icon: GraduationCap, status: 'Not started', action: 'Choose your route' },
  { id: 'admission', title: 'Admission progress', description: 'Record the CAP or institute-level step shown in the official portal.', icon: CheckCircle2, status: 'No progress saved', action: 'Open progress tracker' },
  { id: 'documents', title: 'Document checklist', description: 'Use a route-specific checklist to track the documents you have ready.', icon: FileCheck2, status: 'No progress saved', action: 'View checklist' },
]

export function ApplicantWorkspacePilot() {
  const [activeSection, setActiveSection] = useState('overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const activeItem = sections.find(section => section.id === activeSection) || sections[0]

  const selectSection = section => {
    setActiveSection(section.id)
    setMobileNavOpen(false)
    if (section.id !== 'overview') setNotice(`${section.label} is shown here as a design preview. The working version remains in the current applicant workspace.`)
    else setNotice('')
  }

  const navigation = <nav aria-label="Applicant workspace sections" className="grid gap-1">
    {sections.map(section => {
      const Icon = section.icon
      const current = section.id === activeSection
      return <button
        key={section.id}
        type="button"
        aria-current={current ? 'page' : undefined}
        onClick={() => selectSection(section)}
        className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors ${current ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
      ><Icon aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 truncate">{section.label}</span></button>
    })}
  </nav>

  return <div className="shadcnPilotRoot min-h-screen bg-background text-foreground">
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <img src={mitcorerLogo} width="36" height="36" alt="MITCORER logo" className="size-9 rounded-full bg-white object-contain" />
          <div className="grid min-w-0"><strong className="text-sm tracking-tight">MITCORER</strong><span className="text-xs text-muted-foreground">Applicant workspace</span></div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-3">
          <div><p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">My admission</p>{navigation}</div>
          <Card className="gap-3 border-primary/15 bg-accent/50 py-4 shadow-none">
            <CardContent className="grid gap-2 px-4">
              <div className="flex size-8 items-center justify-center rounded-md bg-card text-primary"><BookOpenCheck aria-hidden="true" className="size-4" /></div>
              <strong className="text-sm">Need help?</strong>
              <p className="text-xs leading-5 text-muted-foreground">Ask Mitra about admissions or contact the college for a verified decision.</p>
              <a href="/" target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">Open current Mitra <ArrowRight aria-hidden="true" className="size-4" /></a>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-3 border-t p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"><UserRound aria-hidden="true" className="size-4" /></span>
          <div className="grid min-w-0 flex-1"><strong className="truncate text-sm">Applicant account</strong><span className="truncate text-xs text-muted-foreground">Preview only</span></div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6">
          <Button variant="outline" size="icon" className="lg:hidden" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} aria-controls="applicant-pilot-mobile-nav" onClick={() => setMobileNavOpen(value => !value)}>{mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</Button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">MIT College of Railway Engineering and Research</p><p className="text-xs text-muted-foreground">Barshi · Applicant services</p></div>
          <Badge variant="outline" className="hidden sm:inline-flex"><span className="size-1.5 rounded-full bg-amber-500" />Design preview</Badge>
        </header>

        <div id="applicant-pilot-mobile-nav" hidden={!mobileNavOpen} className="border-b bg-card p-3 lg:hidden">{navigation}</div>

        <main className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Applicant workspace</p>
              <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{activeSection === 'overview' ? 'My admission journey' : activeItem.label}</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Plan your admission steps, track documents and follow official guidance. Your notes do not submit a CAP form or decide eligibility.</p>
            </div>
            <Badge variant="secondary" className="gap-2 rounded-md px-3 py-1.5"><GraduationCap aria-hidden="true" className="size-4" />Route not selected</Badge>
          </div>

          <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950">Isolated visual pilot. No applicant account data is loaded or changed; current workspace screens remain untouched.</div>

          {notice && <div role="status" aria-live="polite" className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>}

          {activeSection === 'overview' ? <>
            <Card className="overflow-hidden border-primary/15 bg-gradient-to-r from-white to-emerald-50 shadow-sm">
              <CardContent className="flex flex-col items-start justify-between gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
                <div className="grid gap-2"><Badge className="w-fit">Your next step</Badge><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Choose your admission route</h2><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Select First Year B.Tech, Direct Second Year B.Tech or Polytechnic to tailor your programme list and document checklist.</p></div>
                <Button className="w-full sm:w-auto" onClick={() => selectSection(sections.find(section => section.id === 'programmes'))}>Choose route <ArrowRight aria-hidden="true" /></Button>
              </CardContent>
            </Card>

            <section aria-label="Admission preparation sections" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overviewCards.map(item => {
                const Icon = item.icon
                return <Card key={item.id} className="gap-4 shadow-sm transition-shadow hover:shadow-md">
                  <CardHeader className="grid-cols-[1fr_auto] gap-3 pb-0">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary"><Icon aria-hidden="true" className="size-5" /></div>
                    <Badge variant="muted" className="self-start">{item.status}</Badge>
                    <div className="col-span-2"><CardTitle className="text-base">{item.title}</CardTitle><CardDescription className="mt-2 min-h-10 leading-5">{item.description}</CardDescription></div>
                  </CardHeader>
                  <CardContent className="mt-auto"><Button variant="outline" size="sm" className="w-full justify-between" onClick={() => selectSection(sections.find(section => section.id === item.id))}>{item.action}<ChevronRight aria-hidden="true" /></Button></CardContent>
                </Card>
              })}
            </section>

            <Card className="gap-4 shadow-sm">
              <CardHeader className="pb-0"><CardTitle className="text-base">Optional planning tools</CardTitle><CardDescription>Keep secondary details available without crowding your main admission checklist.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {sections.filter(section => ['scholarships', 'stay'].includes(section.id)).map(item => {
                  const Icon = item.icon
                  return <button key={item.id} type="button" onClick={() => selectSection(item)} className="flex min-h-14 items-center gap-3 rounded-lg border bg-card px-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"><Icon aria-hidden="true" className="size-4 text-primary" /><span className="flex-1 text-sm font-medium">{item.label}</span><ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" /></button>
                })}
              </CardContent>
            </Card>

          </> : <Card className="gap-3 shadow-sm"><CardHeader><CardTitle className="text-base">{activeItem.label}</CardTitle><CardDescription>This preview compares the visual system only. Use the current applicant workspace for all saved records and actions.</CardDescription></CardHeader><CardContent><Button variant="outline" onClick={() => selectSection(sections[0])}>Back to overview</Button></CardContent></Card>}

          <footer className="border-t pt-4 text-xs text-muted-foreground">MITCORER applicant workspace · Private account · Official decisions remain with the admission authority and college.</footer>
        </main>
      </div>
    </div>
  </div>
}
