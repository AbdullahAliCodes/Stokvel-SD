import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PageBackNav({
  to,
  label = "Back to dashboard",
  className = "",
}) {
  if (!to) return null;

  return (
    <Link
      to={to}
      className={`mb-6 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-emerald-800 dark:text-stone-400 dark:hover:text-emerald-300 ${className}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
