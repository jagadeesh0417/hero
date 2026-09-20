const steps = [
  {
    number: '01',
    title: 'Select Slot',
    description: 'Choose your preferred date and time slot from available options.',
    color: 'bg-[#1e3a5f]',
  },
  {
    number: '02',
    title: 'Enter Passenger Details',
    description: 'Add passenger names, mobile numbers, and gender information.',
    color: 'bg-[#2e86c1]',
  },
  {
    number: '03',
    title: 'Make Payment',
    description: 'Complete secure payment to confirm your booking instantly.',
    color: 'bg-[#f5a623]',
  },
  {
    number: '04',
    title: 'Get Receipt',
    description: 'Download your booking receipt with all passenger details.',
    color: 'bg-[#10b981]',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-20 bg-white content-visible" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mb-4">
            How It Works
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Book your exam travel in four simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8 relative">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`relative animate-fade-in stagger-${index + 1}`}
            >
              <div className="text-center">
                <div
                  className={`w-16 h-16 ${step.color} text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg`}
                >
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gray-200">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-gray-300 rotate-45" />
                  </div>
                )}
                <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}