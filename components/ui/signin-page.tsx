"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from "lucide-react";

type Blob = {
  size: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
};

// Fixed (non-random) layout so server and client render identically —
// Math.random() here would cause a hydration mismatch.
// Colors must be fully opaque: the gooey filter below clips any pixel
// under ~47% alpha to fully transparent, so translucent fills disappear.
const BLOBS: Blob[] = [
  { size: 320, left: 5, top: 8, delay: 0, duration: 18 },
  { size: 360, left: 62, top: 2, delay: -4, duration: 22 },
  { size: 280, left: 28, top: 52, delay: -8, duration: 20 },
  { size: 340, left: 74, top: 48, delay: -12, duration: 25 },
  { size: 300, left: 0, top: 66, delay: -16, duration: 19 },
  { size: 270, left: 46, top: 26, delay: -2, duration: 23 },
];

interface SignInProps {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
}

export function SignIn({ action, error }: SignInProps) {
  const [showPassword, setShowPassword] = useState(false);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      blobRefs.current.forEach((blob, index) => {
        if (!blob) return;
        const speed = (index + 1) * 14;
        blob.style.marginLeft = `${x * speed}px`;
        blob.style.marginTop = `${y * speed}px`;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black px-4 text-white">
      <svg className="absolute h-0 w-0">
        <defs>
          <filter id="login-gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="pointer-events-none absolute inset-0 opacity-35" style={{ filter: "url(#login-gooey)" }}>
        {BLOBS.map((blob, index) => (
          <div
            key={index}
            ref={(el) => {
              blobRefs.current[index] = el;
            }}
            className="animate-blob absolute rounded-full bg-white blur-2xl transition-[margin] duration-200 ease-out"
            style={{
              width: blob.size,
              height: blob.size,
              left: `${blob.left}%`,
              top: `${blob.top}%`,
              animationDelay: `${blob.delay}s`,
              animationDuration: `${blob.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-12 text-left">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-white">
            <ShieldCheck className="h-3.5 w-3.5" />
            Network Security Center
          </span>
          <h1 className="-ml-0.5 text-5xl font-bold leading-[0.95] tracking-tight text-white">
            Secure
            <br />
            Access
          </h1>
        </div>

        <form action={action} className="space-y-7">
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="group relative">
            <label htmlFor="email" className="mb-3 block text-[11px] uppercase tracking-widest text-white/80">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                required
                className="w-full border-b-2 border-white/40 bg-transparent py-3 pl-7 text-lg text-white outline-none placeholder:text-white/40 focus:border-white"
              />
            </div>
          </div>

          <div className="group relative">
            <label htmlFor="password" className="mb-3 block text-[11px] uppercase tracking-widest text-white/80">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                className="w-full border-b-2 border-white/40 bg-transparent py-3 pl-7 pr-8 text-lg text-white outline-none placeholder:text-white/40 focus:border-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-white py-4 text-sm font-bold uppercase tracking-[0.2em] text-black transition-all hover:tracking-[0.3em] hover:bg-zinc-200"
          >
            Access Dashboard
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-white/60">
          Access is provisioned by your network administrator.
        </p>
      </div>
    </div>
  );
}