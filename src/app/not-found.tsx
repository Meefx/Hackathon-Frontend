import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><span className="eyebrow">404 / COLLECTFLOW</span>
    <h1>Page not found</h1><p>Return to your collections workspace.</p>
    <Link className="button primary" href="/">Open overview</Link></main>;
}
