// Testimonials registry for Avalon Vitality.
// Source of truth for the Real Results carousel. Order is enforced in Testimonials.jsx
// (J.G. → Diplo → R.D. lead by design).

export const testimonials = [
  { quote: "I’m a founder who codes 20hrs a day now. NAD+ makes it happen.", name: "J.G.", tag: "NAD+ IV" },
  { quote: "That was awesome.", name: "Diplo", tag: "ENERGY IV" },
  { quote: "I love NAD+. I knock one out before any big pitch. It's part of my routine now.", name: "R.D.", tag: "NAD+ 1000MG" },
  { quote: "That IV did digits.", name: "Larry June", tag: "RECOVERY IV" },
  { quote: "I'm an AI founder. Every day I gain new abilities. Avalon holds me down through the storm.", name: "J.L.", tag: "PERFORMANCE IV" },
  { quote: "Beauty IV is my weekly. Glutathione drip, every time.", name: "A.G.", tag: "BEAUTY IV" },
  { quote: "Booked Avalon for a festival. Green room was lit. They set up an entire recovery lounge backstage. Artists and crew loved it.", name: "G.B.", tag: "EVENT RECOVERY" },
  { quote: "Who knew CBD IVs were a thing? Zero THC. The most relaxing drip experience I've had. Already booked my next bag.", name: "C.A.", tag: "CBD IV" },
]
.sort((a, b) => {
  const order = { 'J.G.': 0, 'Diplo': 1, 'R.D.': 2 };
  return (order[a.name] ?? 999) - (order[b.name] ?? 999);
});
