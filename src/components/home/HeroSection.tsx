import Link from 'next/link';
import Reveal from '@/components/ui/Reveal';

export default function HeroSection() {
  return (
    <Reveal>
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f]/5 via-white to-[#2e86c1]/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#2e86c1]/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#1e3a5f]/10 rounded-full blur-3xl animate-pulse-slow" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e3a5f]/5 rounded-full text-sm text-[#1e3a5f] font-medium mb-6">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Trusted Exam Travel Service
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-[#1e3a5f] leading-tight mb-6">
            <span className="inline-block">SUMAN TRAVELS</span>
            <br />
            <span className="text-2xl sm:text-3xl md:text-4xl text-gray-600 font-normal">
              Reliable Exam Travel Booking
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Book travel easily for coaching and examination schedules.
            Safe, reliable, and on-time service for your exam journeys.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/book"
              className="btn-primary text-lg px-8 py-4 shadow-lg hover:shadow-xl"
            >
              Book Now
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#contact"
              className="btn-outline text-lg px-8 py-4"
            >
              Contact
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { number: '500+', label: 'Bookings' },
              { number: '98%', label: 'Satisfaction' },
              { number: '24/7', label: 'Support' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center stagger-${i + 1} opacity-0 animate-fade-in`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-[#1e3a5f]">
                  {stat.number}
                </div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}