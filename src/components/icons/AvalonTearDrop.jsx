export default function AvalonTearDrop({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 100 120" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {/* Outer teardrop shape */}
      <path d="M50 10C35 30 20 50 20 70C20 95 32 110 50 110C68 110 80 95 80 70C80 50 65 30 50 10Z" />
      
      {/* Left triangle (A shape) */}
      <path d="M35 50L45 30L50 45Z" fill="white" />
      
      {/* Right triangle (V shape) */}
      <path d="M55 45L60 30L70 50Z" fill="white" />
      
      {/* Center diamond/slash */}
      <path d="M42 40L50 50L42 80M58 40L50 50L58 80" strokeWidth="3" stroke="white" fill="none" strokeLinecap="round" />
    </svg>
  );
}