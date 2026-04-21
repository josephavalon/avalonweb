import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function MembershipDashboard() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Login logic would go here
      await base44.auth.me();
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2a1419] flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-16">
          <div className="w-24 h-24 rounded-full bg-[#1a0c0f] flex items-center justify-center border border-white/10">
            <span className="font-heading text-4xl text-foreground">00</span>
          </div>
        </div>

        {/* Welcome */}
        <h1 className="font-body text-5xl text-foreground text-center mb-4 tracking-wide">
          Welcome
        </h1>
        <p className="font-body text-base text-center text-muted-foreground mb-12 leading-relaxed">
          Access your account to manage your health protocol and track your progress.
        </p>

        {/* Form */}
        <form onSubmit={handleContinue} className="space-y-4 mb-8">
          {/* Email */}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-transparent border border-white/30 rounded-full px-6 py-4 font-body text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/50 transition-colors"
          />

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-transparent border border-white/30 rounded-full px-6 py-4 font-body text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <Eye className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-destructive font-body text-sm">{error}</p>
          )}

          {/* Forgot password */}
          <div className="pt-2">
            <a href="#" className="font-body text-base text-muted-foreground hover:text-foreground transition-colors">
              Forgot password?
            </a>
          </div>

          {/* Continue button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#7a6a6a] hover:bg-[#8a7a7a] disabled:opacity-50 text-[#2a1419] font-body text-lg font-semibold rounded-full py-4 transition-colors mt-8"
          >
            {isLoading ? 'Loading...' : 'Continue'}
          </button>
        </form>

        {/* Sign up link */}
        <div className="text-center">
          <p className="font-body text-base text-muted-foreground">
            Don't have an account?{' '}
            <a href="/apply" className="text-foreground font-semibold hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}