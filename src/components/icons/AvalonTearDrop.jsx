export default function AvalonTearDrop({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 100 140" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      {/* Main teardrop shape */}
      <path d="M50 8C30 35 15 55 15 75C15 105 30 130 50 130C70 130 85 105 85 75C85 55 70 35 50 8Z" />
      
      {/* Left white triangle (A) */}
      <path d="M32 65L42 35L50 65Z" fill="white" />
      
      {/* Right white triangle (V) */}
      <path d="M50 65L58 35L68 65Z" fill="white" />
      
      {/* Diagonal slash through middle */}
      <path d="M40 50L60 85" strokeWidth="4" stroke="white" fill="none" strokeLinecap="round" />
    </svg>
  );
}