/** The Petipop logo (mark + name). `full` adds the tagline, for screens where the logo stands alone. */
export function Logo({ full = false, className = "h-9 w-auto" }) {
  return <img src={full ? "/logo-full.png" : "/logo.png"} alt="Petipop" className={`${className} select-none`} draggable={false} />;
}
