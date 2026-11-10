import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from './supabase';

export default function AuthScreen({ recovery, message, onRecovered, demoOptions = [], onDemo }: {
  recovery: boolean;
  message: string;
  onRecovered: () => void;
  demoOptions?: string[];
  onDemo?: (selection: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot' | 'otp'>('login');
  const [otp, setOtp] = useState('');
  const [retryAt, setRetryAt] = useState(() => {
    try { return Number(sessionStorage.getItem('password-reset-retry-at')) || 0; } catch { return 0; }
  });
  const [now, setNow] = useState(Date.now());
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  function startCooldown() {
    const deadline = Date.now() + 60000;
    setRetryAt(deadline);
    setNow(Date.now());
    try { sessionStorage.setItem('password-reset-retry-at', String(deadline)); } catch { /* Storage may be unavailable. */ }
  }
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [demoRole, setDemoRole] = useState('CRO');
  async function sendCode() {
    if (!supabase || busy || Date.now() < retryAt) return;
    setBusy(true);
    setNotice('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}?auth=recovery`,
      });
      if (error) throw error;
      startCooldown();
      setOtp('');
      setMode('otp');
      setNotice('If this email has an account, a reset code will arrive shortly. Enter the code from the latest email.');
    } catch (error) {
      const authError = error as { status?: number; code?: string };
      if (authError.status === 429 || authError.code === 'over_email_send_rate_limit' || authError.code === 'over_request_rate_limit') {
        startCooldown();
        setNotice('Too many email requests. Please wait before trying again. If the email quota is exhausted, your administrator needs to check email delivery settings.');
      } else setNotice(error instanceof Error ? error.message : 'Unable to send a reset code. Please try again.');
    } finally { setBusy(false); }
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setNotice('Supabase connection is not configured yet.'); return; }
    if (!recovery && mode === 'forgot') { await sendCode(); return; }
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setNotice('');
    try {
      if (recovery) {
        const password = String(values.get('password'));
        if (password !== values.get('confirm')) throw new Error('Passwords do not match.');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error('Your password reset session has expired. Return to sign in and request a new reset code.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        // Require a fresh sign-in after changing the password.
        const { error: logoutError } = await supabase.auth.signOut();
        if (logoutError) throw logoutError;
        onRecovered();
        setMode('login');
        setNotice('Password updated. Sign in with your new password.');
      } else if (mode === 'otp') {
        const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: 'recovery' });
        if (error) throw error;
        if (!data.session) throw new Error('Unable to verify this code. Request a new code and try again.');
        window.history.replaceState({}, '', `${window.location.pathname}?auth=recovery`);
        setOtp('');
        setNotice('Code verified. Choose your new password.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: String(values.get('password')) });
        if (error) throw error;
      }
    } catch (error) {
      const authError = error as { code?: string; status?: number };
      setNotice(authError.code === 'otp_expired' ? 'This code is invalid or has expired. Check the latest email or request a new code.' : authError.status === 429 ? 'Too many attempts. Please wait before trying again.' : error instanceof Error ? error.message : 'Unable to connect. Please try again.');
    } finally { setBusy(false); }
  };
  return <div className="login-page"><div className="login-layout">
    <section className="login-hero" aria-label="Mohafiz Secure System">
      <div className="login-hero-brand"><img className="login-logo" src="/images/mohafiz-logo.png" alt="Mohafiz Secure" width={72} height={72} /><span>Secure incident workflow portal</span></div>
      <div className="login-hero-copy"><h1>Mohafiz<br />Secure System</h1><p className="login-description">Log incidents, assign them to the right city desk, and follow each one through to resolution.</p></div>
    </section>
    <section className="login-card">
      <div className="login-card-heading"><h2>{recovery ? 'Set new password' : mode === 'otp' ? 'Enter reset code' : mode === 'forgot' ? 'Forgot password' : 'Sign in'}</h2></div>
      <form onSubmit={submit}>
        {!recovery && <label>Email<input type="email" autoComplete="username" placeholder="you@company.com" required readOnly={mode === 'otp'} value={email} onChange={event => setEmail(event.target.value)} /></label>}
        {!recovery && mode === 'otp' && <label>Email code<input name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} /></label>}
        {(recovery || mode === 'login') && <div className="password-field">
          <label htmlFor="auth-password">{recovery ? 'New password' : 'Password'}</label>
          <div className="password-input"><input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} required minLength={recovery ? 8 : undefined} autoComplete={recovery ? 'new-password' : 'current-password'} placeholder={recovery ? 'At least 8 characters' : 'Enter your password'} />
            <button type="button" className="password-toggle-btn" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>}
        {recovery && <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" required minLength={8} /></label>}
        <button className="primary full" disabled={busy || !supabase || (!recovery && mode === 'forgot' && remaining > 0)}>{busy ? 'Please wait…' : recovery ? 'Update password' : mode === 'otp' ? 'Verify code' : mode === 'forgot' ? remaining > 0 ? `Try again in ${remaining}s` : 'Send reset code' : 'Sign in'}</button>
        {!recovery && mode === 'otp' && <>
          <button className="link" type="button" disabled={busy || remaining > 0} onClick={() => void sendCode()}>{remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}</button>
        </>}
        {!recovery && mode !== 'otp' && <button className="link" type="button" disabled={busy} onClick={() => { setMode(value => value === 'login' ? 'forgot' : 'login'); setOtp(''); setNotice(''); }}>{mode === 'login' ? 'Forgot password?' : 'Back to sign in'}</button>}
        {recovery && <button className="link" type="button" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const result = await supabase?.auth.signOut({ scope: 'local' });
            if (result?.error) throw result.error;
            onRecovered();
            setMode('login');
            setNotice('');
          } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to sign out. Please try again.'); }
          finally { setBusy(false); }
        }}>Back to sign in</button>}
      </form>
      {!recovery && onDemo && <div className="login-demo-access">
        <label>Demo: sign in as<select value={demoRole} onChange={event => setDemoRole(event.target.value)}>{demoOptions.map(option => <option key={option}>{option}</option>)}</select></label>
        <button type="button" className="full" onClick={() => onDemo(demoRole)}>Open demo</button>
      </div>}
      {(notice || message || !supabase) && <p className="login-status" role="status">{notice || message || 'Supabase connection is not configured yet.'}</p>}
    </section>
  </div></div>;
}
