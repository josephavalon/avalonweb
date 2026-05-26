// Testimonials registry for Avalon Vitality.
// Source of truth for the Real Results carousel. Order is enforced in Testimonials.jsx
// (J.G. → Diplo → R.D. lead by design).

export const testimonials = [
  { quote: "The visit fit into a packed workday and the nurse kept it calm, clear, and efficient.", name: "J.G.", tag: "NAD+ IV" },
  { quote: "That was awesome.", name: "D.P.", tag: "ENERGY IV" },
  { quote: "NAD+ is part of my routine before heavy work weeks. The clinical review was simple.", name: "R.D.", tag: "NAD+ IV" },
  { quote: "The mobile setup felt polished from booking to wrap-up.", name: "L.J.", tag: "RECOVERY IV" },
  { quote: "Avalon makes recovery logistics feel handled, especially during intense launch weeks.", name: "J.L.", tag: "PERFORMANCE IV" },
  { quote: "Beauty IV is my weekly rhythm. Clear menu, clean setup, easy appointment.", name: "A.G.", tag: "BEAUTY IV" },
  { quote: "Booked Avalon for a festival. Green room was lit. They set up an entire recovery lounge backstage. Artists and crew loved it.", name: "G.B.", tag: "EVENT RECOVERY" },
]
.sort((a, b) => {
  const order = { 'J.G.': 0, 'Diplo': 1, 'R.D.': 2 };
  return (order[a.name] ?? 999) - (order[b.name] ?? 999);
});
