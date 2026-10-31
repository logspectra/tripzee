import { LinkButton } from '../components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-sm font-medium text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold">This page took a wrong turn</h1>
      <p className="mt-2 text-muted">The page you're looking for doesn't exist or has moved.</p>
      <LinkButton to="/" className="mt-6">Back to home</LinkButton>
    </div>
  );
}
