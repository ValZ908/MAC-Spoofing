"use client";

import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, ShieldCheck, LucideIcon } from "lucide-react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card = ({ children, className = "" }: CardProps) => (
  <div className={`bg-card border border-border rounded-lg ${className}`}>
    {children}
  </div>
);

interface FormHeaderProps {
  title: string;
  subtitle: string;
}

const FormHeader = ({ title, subtitle }: FormHeaderProps) => (
  <div className="space-y-2 text-center">
    <h1 className="text-3xl font-bold tracking-tight text-foreground">
      {title}
    </h1>
    <p className="text-muted-foreground">{subtitle}</p>
  </div>
);

interface InputFieldProps {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  icon: LucideIcon;
  required?: boolean;
}

const InputField = ({
  id,
  type,
  label,
  placeholder,
  icon: Icon,
  required = false,
}: InputFieldProps) => (
  <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-foreground">
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-foreground placeholder:text-muted-foreground transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-background"
      />
    </div>
  </div>
);

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  showPassword: boolean;
  onTogglePassword: () => void;
  required?: boolean;
}

const PasswordField = ({
  id,
  label,
  placeholder,
  showPassword,
  onTogglePassword,
  required = false,
}: PasswordFieldProps) => (
  <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-foreground">
      {label}
    </label>
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        name={id}
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-10 text-foreground placeholder:text-muted-foreground transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-background"
      />
      <button
        type="button"
        onClick={onTogglePassword}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-300 hover:text-foreground"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  </div>
);

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  children: React.ReactNode;
}

const Button = ({ type = "button", children }: ButtonProps) => (
  <button
    type={type}
    className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-slate-200 to-white font-medium text-slate-900 shadow-lg transition-all duration-300 hover:from-white hover:to-white focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-background"
  >
    {children}
  </button>
);

interface AnimatedBlobProps {
  color: string;
  position: string;
  delayClassName?: string;
}

const AnimatedBlob = ({
  color,
  position,
  delayClassName = "",
}: AnimatedBlobProps) => (
  <div
    className={`absolute ${position} h-72 w-72 ${color} animate-blob rounded-full opacity-70 mix-blend-screen blur-xl ${delayClassName}`}
  />
);

const GradientWave = () => (
  <div className="absolute inset-0 opacity-20">
    <svg
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 1440 560"
    >
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gradient1)"
        d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,218.7C672,235,768,245,864,234.7C960,224,1056,192,1152,186.7C1248,181,1344,203,1392,213.3L1440,224L1440,560L1392,560C1344,560,1248,560,1152,560C1056,560,960,560,864,560C768,560,672,560,576,560C480,560,384,560,288,560C192,560,96,560,48,560L0,560Z"
      />
    </svg>
  </div>
);

const IconBadge = ({ icon }: { icon: React.ReactNode }) => (
  <div className="mb-4 inline-flex rounded-full bg-white/10 p-3 text-white backdrop-blur-sm">
    {icon}
  </div>
);

interface HeroSectionProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

const HeroSection = ({ title, description, icon }: HeroSectionProps) => (
  <div className="max-w-md space-y-6 text-center">
    {icon && <IconBadge icon={icon} />}
    <h2 className="text-3xl font-bold text-white lg:text-4xl">{title}</h2>
    <p className="text-lg text-white/80">{description}</p>
  </div>
);

const GradientBackground = ({ children }: { children: React.ReactNode }) => (
  <div className="relative hidden flex-1 overflow-hidden lg:flex">
    <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900 to-black" />
    <div className="absolute inset-0">
      <AnimatedBlob color="bg-slate-400/30" position="-left-4 top-0" />
      <AnimatedBlob
        color="bg-zinc-500/30"
        position="-right-4 top-0"
        delayClassName="[animation-delay:4s]"
      />
      <AnimatedBlob
        color="bg-gray-300/20"
        position="-bottom-8 left-20"
        delayClassName="[animation-delay:8s]"
      />
    </div>
    <GradientWave />
    <div className="relative z-10 flex w-full items-center justify-center p-8 lg:p-12">
      {children}
    </div>
  </div>
);

interface SignInProps {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
}

export function SignIn({ action, error }: SignInProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-8">
          <FormHeader
            title="Welcome back"
            subtitle="Sign in to monitor your network"
          />

          <Card className="p-6 shadow-sm sm:p-8">
            <form action={action} className="space-y-6">
              {error && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </div>
              )}

              <InputField
                id="email"
                type="email"
                label="Email"
                placeholder="admin@example.com"
                icon={Mail}
                required
              />

              <PasswordField
                id="password"
                label="Password"
                placeholder="Enter your password"
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword((v) => !v)}
                required
              />

              <Button type="submit">Sign in</Button>
            </form>
          </Card>
        </div>
      </div>

      <GradientBackground>
        <HeroSection
          title="Real-Time Threat Detection"
          description="Monitor every device on your network, get instant alerts on MAC spoofing and ARP poisoning attempts, and block attackers with a single click."
          icon={<ShieldCheck className="h-12 w-12" />}
        />
      </GradientBackground>
    </div>
  );
}
