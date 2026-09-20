'use client';

export default function FullScreenLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-10 shadow-2xl flex flex-col items-center gap-4 min-w-[220px]">
        <div className="w-12 h-12 border-[3px] border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#1e3a5f] font-bold text-lg">{message}</p>
        <p className="text-gray-400 text-sm">Please wait...</p>
      </div>
    </div>
  );
}
