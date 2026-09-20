import services from './servicesData';

export default function ServicesSection() {
  return (
    <section className="py-20 bg-gray-50 content-visible" id="services">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] mb-4">
            Our Services
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Comprehensive travel solutions for all your exam needs
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className={`glass-card p-6 text-center card-hover animate-fade-in stagger-${index + 1}`}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1e3a5f]/5 flex items-center justify-center text-[#1e3a5f]">
                {service.icon}
              </div>
              <h3 className="text-lg font-bold text-[#1e3a5f] mb-2">{service.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}