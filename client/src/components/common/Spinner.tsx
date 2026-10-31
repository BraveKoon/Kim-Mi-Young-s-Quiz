export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-white/70">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-blue-400" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}
