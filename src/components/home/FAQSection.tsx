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
  return (
    <section className="py-20 bg-white content-visible" id="faq">
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
              <details
              key={index}
              className={`glass-card overflow-hidden animate-fade-in stagger-${index + 1}`}
            >
              <summary className="flex items-center justify-between p-5 text-left cursor-pointer list-none font-semibold text-gray-900 pr-4">
                {faq.q}
                <svg
                  className="w-5 h-5 text-gray-400 shrink-0 transition-transform"
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
              </summary>
              <p className="px-5 pb-5 text-gray-500 leading-relaxed">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
