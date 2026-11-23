export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="banner-error" role="alert">
      {message}
    </div>
  );
}
