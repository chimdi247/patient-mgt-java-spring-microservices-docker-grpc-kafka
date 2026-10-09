import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { HeartPulse, ShieldCheck, Workflow } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="pulse-grid relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <span className="font-display text-2xl font-semibold tracking-tight">CareDesk</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="font-display text-5xl font-semibold leading-[1.08] tracking-tight">Every patient, one calm place.</h2>
          <p className="mt-5 text-lg text-white/70">Register patients, keep their details current, and let billing and analytics follow automatically.</p>
          <ul className="mt-10 space-y-4 text-sm text-white/80">
            <li className="flex items-center gap-3"><HeartPulse className="h-5 w-5 text-accent" />Records you can find in seconds</li>
            <li className="flex items-center gap-3"><Workflow className="h-5 w-5 text-accent" />A billing account opens the moment a patient is registered</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-accent" />Role-based access: only administrators can delete</li>
          </ul>
        </div>
        <p className="relative text-sm text-white/45">Spring Boot microservices behind one secure gateway.</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><BrandMark className="h-8 w-8" /><span className="font-display text-xl font-semibold">CareDesk</span></div>
          <h1 className="text-3xl font-semibold">Welcome back</h1>
          <p className="mb-7 mt-2 text-sm text-muted-foreground">Sign in with your staff account.</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
          </form>

          <button
            type="button"
            onClick={() => { setEmail("admin@example.com"); setPassword("password123"); }}
            className="mt-4 w-full rounded-md border border-dashed px-3 py-2.5 text-left text-xs text-muted-foreground hover:bg-secondary"
          >
            Local demo: fill in the seeded administrator (admin@example.com)
          </button>
        </div>
      </div>
    </div>
  );
}
