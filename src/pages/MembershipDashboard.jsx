import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

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

  const inputClass = "w-full bg-transparent border border-white/15 rounded-full px-5 py-3 font-body text-xs text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:border-white/35 transition-colors";

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-28 md:pt-32 pb-8 md:pb-10 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-heading text-5xl md:text-6xl text-foreground tracking-wide mb-2">
            WELCOME BACK
          </h1>
          <p className="font-body text-xs text-muted-foreground max-w-md mx-auto">
            Access your account to manage your health protocol and track your progress.
          </p>
        </motion.div>
      </section>

      {/* Form Section */}
      <section className="py-6 md:py-8 px-4">
        <div className="max-w-sm mx-auto">
          <form onSubmit={handleContinue} className="w-full space-y-2.5">

            {/* Email */}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-destructive font-body text-sm">{error}</p>
            )}

            {/* Forgot password */}
            <div className="pt-1">
              <a href="#" className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase">
                Forgot password?
              </a>
            </div>

            {/* Continue button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full py-3 hover:bg-foreground/90 transition-colors mt-3 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Continue'}
            </button>

            <p className="text-center font-body text-xs text-muted-foreground/75 pt-1">
              Don't have an account?{' '}
              <Link to="/apply" className="text-foreground font-semibold hover:underline">
                Apply Now
              </Link>
            </p>

          </form>
        </div>
      </section>
      <Footer />
    </div>
  );
}