'use client';

import { useState, useEffect, useRef } from 'react';

const faqs = [
  {
    q: 'How do I book exam travel?',
    a: 'Simply click on "Book Now", select your preferred date and time slot, enter passenger details, complete payment, and your booking is confirmed.',
  },
  {
    q: 'Can I book multiple tickets at once?',
    a: 'Yes, you can book multiple tickets in a single booking. Each passenger needs their details entered separately.',
  },
  {
    q: 'How do I get my booking receipt?',
    a: 'After successful payment, you will receive a booking ID and can download a detailed Word document receipt with all passenger information.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept various payment methods through our secure payment gateway. All transactions are processed securely.',
  },
  {
    q: 'Can I cancel my booking?',
    a: 'Please contact us directly at +91 9010532226 or +91 8639511463 for cancellation requests and refund policies.',
  },
  {
    q: 'Is there a limit on passenger count?',
    a: 'You can book up to the available capacity of the selected time slot. Check remaining availability before booking.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-20 bg-white opacity-0" id="faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-500 text-lg">
            Everything you need to know about booking with us
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`glass-card overflow-hidden stagger-${index + 1} opacity-0 animate-fade-in`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-semibold text-gray-900 pr-4">
                  {faq.q}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div
                className={`transition-all duration-300 ease-in-out ${
                  openIndex === index
                    ? 'max-h-96 opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-5 pb-5 text-gray-500 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
