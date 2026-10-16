import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from '@/components/layout/Footer';
import { usePlatformStats } from '@/utils/platformStats';

const NAV_LINKS = [
  { to: '/',          label: 'Home'      },
  { to: '/directory', label: 'Directory' },
  { to: '/faculty',   label: 'Faculty'   },
  { to: '/gallery',   label: 'Gallery'   },
  { to: '/sections',  label: 'Sections'  },
];

const EXPLORE = [
  {
    img:   '/images/nustud.jpg',
    title: 'Student Directory',
    desc:  'Find classmates and connect with alumni from various batches.',
    to:    '/directory',
    badge: 'DIRECTORY',
    badgeCls: 'bg-indigo-500/80',
  },
  {
    img:   '/images/gallerynu.jpg',
    title: 'Photo Gallery',
    desc:  'Browse collections from university events and memorable moments.',
    to:    '/gallery',
    badge: 'GALLERY',
    badgeCls: 'bg-emerald-500/80',
  },
  {
    img:   '/images/nufaculty.jpg',
    title: 'Faculty & Staff',
    desc:  'Meet the mentors and staff who guided your academic journey.',
    to:    '/faculty',
    badge: 'FACULTY',
    badgeCls: 'bg-amber-500/80',
  },
];

const FEATURES = [
  { icon: 'fas fa-shield-alt',     title: 'Private & Secure',    desc: 'Your data stays within the NU Lipa community. Privacy-first by design.'  },
  { icon: 'fas fa-mobile-alt',     title: 'Works Everywhere',    desc: 'Seamlessly browse on desktop, tablet, or mobile — always looks great.'    },
  { icon: 'fas fa-sync-alt',       title: 'Always Up to Date',   desc: 'New batches and galleries are added each semester automatically.'           },
  { icon: 'fas fa-comment-dots',   title: 'Stay Connected',      desc: 'Message classmates and stay in touch with the people who matter.'   },
];

export default function LandingPage() {
  const stats = usePlatformStats();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [hideScroll, setHideScroll] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
      setHideScroll(window.scrollY > 100);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1d2b4b] antialiased">

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-[background] duration-300 ease-in-out ${
        scrolled ? 'bg-[#1B2A4A] shadow-md' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between h-16 sm:h-18">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 no-underline shrink-0">
            <img src="/images/NU_logo.png" alt="NU Lipa" className="h-9 object-contain" />
            <div className="leading-tight">
              <p className="text-white font-black text-xs uppercase tracking-widest m-0">Sinag-Bughaw</p>
              <p className="text-[#fdb813] font-semibold text-[9px] tracking-[2px] uppercase m-0">Digital Yearbook</p>
            </div>
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex gap-1 list-none m-0 bg-white/10 backdrop-blur-sm px-2 py-1.5 rounded-full border border-white/10">
            {NAV_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="text-white/90 text-sm font-medium no-underline px-4 py-1.5 rounded-full hover:bg-white/15 hover:text-white transition-all block"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-white/80 hover:text-white font-medium text-sm no-underline transition">
              Log in
            </Link>
            <Link
              to="/register"
              className="bg-[#fdb813] text-[#1d2b4b] font-bold text-sm px-5 py-2.5 rounded-lg no-underline hover:bg-yellow-300 transition-colors shadow-md shadow-[#fdb813]/30"
            >
              Join Free
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden text-white text-xl p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle navigation"
          >
            <i className={mobileOpen ? 'fas fa-times' : 'fas fa-bars'} />
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden bg-[#1d2b4b]/98 backdrop-blur-lg border-t border-white/10 px-5 pb-5 pt-3">
            <ul className="list-none m-0 flex flex-col gap-1">
              {NAV_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="block text-white/80 hover:text-white text-sm font-medium no-underline py-2.5 px-3 rounded-lg hover:bg-white/10 transition"
                    onClick={() => setMobileOpen(false)}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 mt-4">
              <Link to="/login"    className="flex-1 text-center text-white font-semibold text-sm no-underline py-2.5 border border-white/20 rounded-lg hover:bg-white/10 transition">Log in</Link>
              <Link to="/register" className="flex-1 text-center bg-[#fdb813] text-[#1d2b4b] font-bold text-sm no-underline py-2.5 rounded-lg hover:bg-yellow-300 transition">Join Free</Link>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1">

      {/* Hero */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center text-center text-white px-5 bg-[linear-gradient(to_bottom,rgba(29,43,75,0.82)_0%,rgba(29,43,75,0.65)_60%,rgba(29,43,75,0.9)_100%),url('/images/NU-building.jpg')] bg-cover bg-center bg-no-repeat"
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[length:60px_60px] opacity-[0.04]"
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 bg-[#fdb813]/15 border border-[#fdb813]/30 text-[#fdb813] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-8">
            <i className="fas fa-star text-[10px]" />
            Excellence in Education
          </span>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            Your Legacy,
            <br />
            <span className="text-[#fdb813]">Digitally&nbsp;Preserved.</span>
          </h1>

          <p className="text-base sm:text-lg text-white/75 leading-relaxed mb-10 max-w-xl mx-auto">
            The official NU Lipa Digital Yearbook. Connect with alumni,
            celebrate achievements, and relive your university memories.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/directory"
              className="inline-flex items-center gap-2.5 bg-[#fdb813] text-[#1d2b4b] font-black text-sm px-8 py-4 rounded-xl no-underline hover:bg-yellow-300 transition-colors shadow-xl shadow-[#fdb813]/25"
            >
              <i className="fas fa-search" />
              Browse Directory
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2.5 border-2 border-white/30 text-white font-semibold text-sm px-8 py-4 rounded-xl no-underline hover:bg-white/10 hover:border-white/50 transition-all"
            >
              Join Free
              <i className="fas fa-arrow-right text-xs" />
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        {!hideScroll && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/80">
            <span className="text-[10px] uppercase tracking-widest font-semibold">Scroll</span>
            <i className="fas fa-chevron-down text-xs animate-bounce" />
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 w-full -mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(({ icon, value, label }) => (
            <div key={label} className="bg-white rounded-2xl px-6 py-6 flex items-center gap-4 shadow-xl shadow-slate-200/80 border border-slate-100">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl shrink-0 bg-amber-400/15 text-[#F5A623]">
                <i className={icon} />
              </div>
              <div>
                <p className="text-3xl font-black text-[#1d2b4b] m-0 leading-none">{value}</p>
                <p className="text-sm text-slate-400 m-0 mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Explore */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-24 w-full">
        <div className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-[#3f51b5]">Explore</span>
          <h2 className="text-4xl sm:text-5xl font-black text-[#1d2b4b] mt-2 mb-3 tracking-tight">Explore the Yearbook</h2>
          <p className="text-slate-400 text-base max-w-md mx-auto">
            Discover the vibrant community of NU Lipa through our curated sections.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {EXPLORE.map(({ img, title, desc, to, badge, badgeCls }) => (
            <Link key={to} to={to} className="no-underline group block">
              <div className="relative rounded-3xl overflow-hidden h-[440px] sm:h-[500px]">
                {/* Image */}
                <img
                  src={img}
                  alt={title}
                  className="w-full h-full object-cover brightness-[0.7] group-hover:scale-105 group-hover:brightness-75 transition-all duration-700 ease-in-out"
                />

                {/* Badge */}
                <span className={`absolute top-5 left-5 ${badgeCls} backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>
                  {badge}
                </span>

                {/* Bottom content */}
                <div className="absolute bottom-0 left-0 w-full p-7 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.3)_60%,rgba(0,0,0,0.1)_100%)] text-white">
                  <h3 className="text-xl font-black mb-2 group-hover:text-[#fdb813] transition-colors">{title}</h3>
                  <p className="text-sm text-white/75 leading-relaxed mb-4">{desc}</p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#fdb813] group-hover:gap-3 transition-all">
                    Explore <i className="fas fa-arrow-right text-[10px]" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#f4f7fe] py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-[#3f51b5]">Why Sinag-Bughaw</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1d2b4b] mt-2 tracking-tight">
              Built for Pioneers
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-[#3f51b5] flex items-center justify-center text-lg mb-4">
                  <i className={icon} />
                </div>
                <h3 className="text-[15px] font-bold text-[#1d2b4b] mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed m-0">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial / Quote */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-24 text-center">
        <div className="relative">
          <i className="fas fa-quote-left text-6xl text-indigo-100 absolute -top-4 left-1/2 -translate-x-1/2" aria-hidden="true" />
          <blockquote className="relative z-10">
            <p className="text-xl sm:text-2xl font-semibold text-[#1d2b4b] leading-relaxed italic mb-6">
              "Sinag-Bughaw brought back memories I thought were lost forever. Seeing classmates I hadn't spoken to in years — priceless."
            </p>
            <footer>
              <div className="flex items-center justify-center gap-3">
                <img
                  src="https://ui-avatars.com/api/?name=Maria+Santos&background=1d2b4b&color=fdb813&size=48"
                  className="w-10 h-10 rounded-full"
                  alt="Maria Santos"
                />
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1d2b4b] m-0">Maria Santos</p>
                  <p className="text-xs text-slate-400 m-0">BS Computer Science, Batch 2019</p>
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="px-5 sm:px-8 pb-24 max-w-7xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d2b4b] via-[#2a3b6b] to-[#3f51b5] text-white text-center py-20 px-6">
          {/* Decorative ring */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/5" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full border border-white/5" />
          <div className="absolute top-8 right-8 w-3 h-3 rounded-full bg-[#fdb813]/40" />
          <div className="absolute bottom-10 left-12 w-2 h-2 rounded-full bg-[#fdb813]/30" />

          <div className="relative z-10">
            <span className="inline-block bg-[#fdb813]/15 border border-[#fdb813]/25 text-[#fdb813] text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
              Get Started Today
            </span>
            <h2 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight">
              Ready to Relive<br className="hidden sm:block" /> Your Memories?
            </h2>
            <p className="text-white/60 text-base mb-10 max-w-md mx-auto leading-relaxed">
              Join thousands of NU Lipa alumni who have already created their digital legacy.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/register"
                className="bg-[#fdb813] text-[#1d2b4b] font-black px-10 py-4 rounded-xl no-underline text-sm hover:bg-yellow-300 transition-colors shadow-xl shadow-[#fdb813]/20 inline-block"
              >
                Get Started — It's Free
              </Link>
              <Link
                to="/directory"
                className="border border-white/20 text-white font-semibold text-sm px-8 py-4 rounded-xl no-underline hover:bg-white/10 transition-colors inline-block"
              >
                Browse Directory
              </Link>
            </div>
          </div>
        </div>
      </section>

      </main>

      <Footer />
    </div>
  );
}
