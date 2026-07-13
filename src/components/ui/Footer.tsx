export default function Footer() {
  return (
    <footer className="bg-[#1e3a5f] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-3">SUMAN TRAVELS</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Reliable exam travel booking services for coaching and examination schedules.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="text-gray-300 hover:text-white transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="/book" className="text-gray-300 hover:text-white transition-colors">
                  Book Travel
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3">Contact</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <a
                  href="tel:+919010532226"
                  className="hover:text-white transition-colors"
                >
                  +91 9010532226
                </a>
              </li>
              <li>
                <a
                  href="tel:+918639511463"
                  className="hover:text-white transition-colors"
                >
                  +91 8639511463
                </a>
              </li>
              <li>Lalitha Nagar, NGO Colony</li>
              <li>Nandyala, Andhra Pradesh – 518502</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-600 mt-8 pt-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Suman Travels. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
