import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-32">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">mojfrizer</p>
      <h1 className="mt-6 font-serif text-6xl">Prijava</h1>
      <LoginForm />
    </main>
  );
}
