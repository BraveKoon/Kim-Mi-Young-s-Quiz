export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-600">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      {label && <p className="text-sm font-medium">{label}</p>}
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
