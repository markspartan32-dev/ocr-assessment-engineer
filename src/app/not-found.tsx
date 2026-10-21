import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-xl font-semibold">That page isn&apos;t on the specification</h1>
      <p className="mt-2 text-sm text-fg-muted">Units run from F200 to F206.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Back to the command centre
      </Link>
    </div>
  );
}
