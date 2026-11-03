import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { CustomerAccountType, CustomerProfile } from '../types/catalog';
import {
  formatFirebaseAuthError,
  registerCustomerWithEmail,
  resetCustomerPassword,
  signInCustomerWithEmail,
  signInCustomerWithGoogle,
} from '../lib/firebase';

export type AuthModalMode = 'signin' | 'register' | 'reset';

interface CustomerAuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  pendingBulkOrderNotice?: boolean;
  onClose: () => void;
  onAuthenticated: (profile: CustomerProfile) => void;
}

const ACCOUNT_TYPES: CustomerAccountType[] = [
  'Individual Customer',
  'Business Buyer',
  'Event Planner',
  'Decorator',
  'Wholesaler',
  'Corporate Buyer',
];

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  initialMode = 'signin',
  pendingBulkOrderNotice = false,
  onClose,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [accountType, setAccountType] = useState<CustomerAccountType>('Individual Customer');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showLegalTerms, setShowLegalTerms] = useState<'privacy' | 'terms' | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const profile = await signInCustomerWithGoogle();
      onAuthenticated(profile);
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (mode === 'reset') {
      setLoading(true);
      try {
        await resetCustomerPassword(email);
        setSuccessMsg(
          `Password reset instructions have been sent to ${email.trim()}. Please check your inbox.`
        );
      } catch (err) {
        setErrorMsg(formatFirebaseAuthError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        if (fullName.trim().length < 2) {
          setErrorMsg('Please enter your full name.');
          setLoading(false);
          return;
        }
        const profile = await registerCustomerWithEmail({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          phoneNumber: phoneNumber.trim(),
          whatsappNumber: phoneNumber.trim(),
          businessName: businessName.trim(),
          accountType,
        });
        onAuthenticated(profile);
      } else {
        const profile = await signInCustomerWithEmail(email.trim(), password);
        onAuthenticated(profile);
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desidiya-auth-modal-title"
    >
      <div className="relative my-8 w-full max-w-md rounded-2xl border border-stone-200 bg-[#FAF7F2] text-stone-900 shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute right-4 top-4 rounded-lg p-2 text-stone-500 hover:bg-stone-200/70 hover:text-stone-900 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand Identity Header */}
        <div className="border-b border-stone-200/80 bg-white px-6 pt-7 pb-5 text-center space-y-2">
          <img
            src="/assets/aistudio/logo_3e12495b.png"
            alt="DesiDiya — Lighting Up Every Celebration"
            className="mx-auto h-14 w-auto object-contain"
          />
          <h2 id="desidiya-auth-modal-title" className="font-serif text-2xl font-bold text-stone-950">
            Welcome to DesiDiya
          </h2>
          <p className="text-xs font-medium tracking-wide text-amber-800 uppercase">
            Lighting Up Every Celebration
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Mandatory Login Gate Banner when triggered before Bulk Order submission */}
          {pendingBulkOrderNotice && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Sign In Required for Bulk Order Submission:</strong> Please sign in or create your DesiDiya
                customer account to submit your bulk inquiry and track quotations. Your selected products and quantities
                are safely preserved.
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Primary Google Sign-In Button */}
          {mode !== 'reset' && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white px-4 py-3 text-xs font-bold text-stone-900 shadow-2xs hover:bg-stone-50 disabled:opacity-50 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.6 6.4C.6 8.4 0 10.6 0 12s.6 3.6 1.6 5.6l3.7-2.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 19.9 7.4 23 12 23z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex py-0.5 items-center">
                <div className="grow border-t border-stone-300/80" />
                <span className="shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Or {mode === 'register' ? 'Create Account with Email' : 'Sign In with Email'}
                </span>
                <div className="grow border-t border-stone-300/80" />
              </div>
            </>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="auth-fullname" className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    placeholder="e.g. Aarav Mehta"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="auth-phone" className="block text-xs font-semibold text-stone-700 mb-1">
                      Mobile / WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                      <input
                        id="auth-phone"
                        type="tel"
                        placeholder="9820112233"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border border-stone-300 bg-white pl-8 pr-3 py-2 text-xs text-stone-900 focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="auth-account-type" className="block text-xs font-semibold text-stone-700 mb-1">
                      Account Type
                    </label>
                    <select
                      id="auth-account-type"
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as CustomerAccountType)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-amber-600 focus:outline-none"
                    >
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-business" className="block text-xs font-semibold text-stone-700 mb-1">
                    Business / Event Company Name (Optional)
                  </label>
                  <input
                    id="auth-business"
                    type="text"
                    placeholder="e.g. Royal Celebrations & Decor"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-stone-700 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3.5 py-2.5 text-xs text-stone-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="auth-password" className="block text-xs font-semibold text-stone-700">
                    Password *
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-[11px] font-semibold text-amber-800 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white pl-10 pr-3.5 py-2.5 text-xs text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {mode === 'signin' && (
                <>
                  <KeyRound className="h-4 w-4 text-amber-400" />
                  <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                </>
              )}
              {mode === 'register' && (
                <>
                  <UserPlus className="h-4 w-4 text-amber-400" />
                  <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                </>
              )}
              {mode === 'reset' && (
                <span>{loading ? 'Sending Reset Link...' : 'Send Password Reset Email'}</span>
              )}
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="border-t border-stone-200 pt-4 text-center text-xs text-stone-600">
            {mode === 'signin' && (
              <div>
                New to DesiDiya?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="font-bold text-amber-800 hover:underline"
                >
                  Create Account
                </button>
              </div>
            )}
            {mode === 'register' && (
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="font-bold text-amber-800 hover:underline"
                >
                  Sign In
                </button>
              </div>
            )}
            {mode === 'reset' && (
              <div>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="font-bold text-amber-800 hover:underline"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>

          {/* Privacy Policy & Terms Links */}
          <div className="text-center text-[11px] text-stone-500 space-y-2">
            <div>
              By continuing, you agree to DesiDiya&apos;s{' '}
              <button
                type="button"
                onClick={() => setShowLegalTerms(showLegalTerms === 'terms' ? null : 'terms')}
                className="underline hover:text-stone-800"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setShowLegalTerms(showLegalTerms === 'privacy' ? null : 'privacy')}
                className="underline hover:text-stone-800"
              >
                Privacy Policy
              </button>
              .
            </div>
            {showLegalTerms === 'privacy' && (
              <div className="rounded-lg border border-stone-200 bg-white p-2.5 text-left text-[11px] text-stone-600">
                <strong>DesiDiya Privacy Guarantee:</strong> Your contact details, GSTIN, and delivery addresses are
                protected by Firebase Authentication and Cloud Firestore row-level security rules. Only you and
                authorized DesiDiya fulfillment administrators can access your inquiries.
              </div>
            )}
            {showLegalTerms === 'terms' && (
              <div className="rounded-lg border border-stone-200 bg-white p-2.5 text-left text-[11px] text-stone-600">
                <strong>DesiDiya Bulk Inquiry Terms:</strong> Submitting a bulk inquiry creates a quotation request
                without upfront payment. Final wholesale pricing, GST, and dispatch timelines are confirmed via official
                DesiDiya quotation.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
