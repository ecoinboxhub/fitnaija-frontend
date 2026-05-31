import React, { useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const STORAGE_KEY = 'fitnaija_auth';
let authToken = '';
let currentUser = null;
let userActivities = [];

function loadAuth() {
    try {
        const payload = window.localStorage.getItem(STORAGE_KEY);
        if (payload) {
            const parsed = JSON.parse(payload);
            authToken = parsed.token || '';
            currentUser = parsed.user || null;
        }
    } catch (error) {
        console.warn('Failed to load auth state', error);
    }
}

function saveAuth(user, token) {
    authToken = token;
    currentUser = user;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
}

function clearAuth() {
    authToken = '';
    currentUser = null;
    window.localStorage.removeItem(STORAGE_KEY);
}

loadAuth();

async function apiCall(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const config = {
            ...options,
            headers,
        };

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(API_BASE + endpoint, config);
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        if (!response.ok) {
            throw new Error((data && data.detail) || data?.message || response.statusText || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error(`[API Error] ${endpoint}:`, error.message);
        throw error;
    }
}

const fmt = (n) => (n ? n.toLocaleString() : '0');
const fmtNaira = (n) => '₦' + (n || 0).toLocaleString();
const locationLabel = (l) => (l ? l.charAt(0).toUpperCase() + l.slice(1).replace('_', ' ') : '—');
const activityIcon = (t) => (t === 'running' ? '🏃' : t === 'cycling' ? '🚴' : '👟');

function formatRelativeTime(timestamp) {
    const date = new Date(timestamp);
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
    return Math.floor(diff / 86400) + ' days ago';
}

function Avatar({ label, size = 36, color = '#c9dff0', textColor = '#1a3a52' }) {
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: color,
                color: textColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: size * 0.33,
                flexShrink: 0,
                fontFamily: '"DM Sans", Arial, sans-serif',
                border: '2px solid rgba(255,255,255,0.7)',
            }}
        >
            {label}
        </div>
    );
}

function Rank({ n }) {
    if (n === 1) return <span className="medal-1 font-bold text-lg">🥇</span>;
    if (n === 2) return <span className="medal-2 font-bold text-lg">🥈</span>;
    if (n === 3) return <span className="medal-3 font-bold text-lg">🥉</span>;
    return <span className="text-sm font-semibold text-muted">#{n}</span>;
}

function ChallengeCard({ ch, onClick }) {
    const statusClass = { active: 'badge-active', upcoming: 'badge-upcoming', verification: 'badge-trial', settled: 'badge-settled' };
    const statusLabel = { active: 'Live', upcoming: 'Upcoming', verification: 'In Review', settled: 'Settled' };

    return (
        <div
            className="glass rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all fade-up"
            style={{ borderLeft: ch.status === 'active' ? '3px solid #ff5b1f' : '3px solid #c9dff0' }}
            onClick={() => onClick && onClick(ch)}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{activityIcon(ch.activity_type)}</span>
                        <span className={`badge ${statusClass[ch.status] || 'badge-upcoming'}`}>{statusLabel[ch.status]}</span>
                    </div>
                    <h3 className="serif text-lg leading-tight text-offgray">{ch.title}</h3>
                </div>
                {ch.prize_pool > 0 && (
                    <div className="text-right flex-shrink-0">
                        <div className="text-xs text-faint mb-0.5">Prize Pool</div>
                        <div className="font-bold text-accent text-base">{fmtNaira(ch.prize_pool)}</div>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted mt-2">
                <span className="chip">{ch.participants} participants</span>
                {ch.location_scope && <span className="chip">📍 {locationLabel(ch.location_scope)}</span>}
                {ch.entry_fee > 0 && <span className="chip">Entry: {fmtNaira(ch.entry_fee)}</span>}
            </div>
        </div>
    );
}

function LandingScreen({ onLogin }) {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [tempToken, setTempToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setError('');
    }, [step]);

    const handleSendOtp = async () => {
        if (!phone || phone.length < 10) {
            setError('Enter a valid phone number.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await apiCall('/auth/send-otp', {
                method: 'POST',
                body: { phone },
            });
            setStep(2);
        } catch (e) {
            setError(`Failed to send OTP: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 4) {
            setError('Enter the OTP you received.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const data = await apiCall('/auth/verify-otp', {
                method: 'POST',
                body: { phone, otp },
            });

            if (data.is_new) {
                setTempToken(data.token);
                setStep(3);
            } else {
                saveAuth(data.user, data.token);
                onLogin();
            }
        } catch (e) {
            setError(`Verification failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProfile = async () => {
        if (!name.trim()) {
            setError('Please enter your display name.');
            return;
        }
        if (!location) {
            setError('Please select your location.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            authToken = tempToken;
            const data = await apiCall('/auth/create-profile', {
                method: 'POST',
                body: { display_name: name.trim(), location },
            });
            saveAuth(data.user, data.token);
            onLogin();
        } catch (e) {
            setError(`Profile creation failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const steps = [{ n: 1, label: 'Phone' }, { n: 2, label: 'Verify' }, { n: 3, label: 'Profile' }];

    return (
        <div className="page-center">
            <div className="w-full max-w-3xl px-6">
                <div className="hero-panel mx-auto mb-8 text-center max-w-2xl">
                    <div className="inline-flex items-center gap-3 mb-4 justify-center">
                        <div className="brand-mark">F</div>
                        <span className="serif text-2xl text-offgray tracking-tight">FitNaija</span>
                    </div>
                    <h1 className="serif hero-title mb-3">AI-powered fitness for Naija challengers.</h1>
                    <p className="hero-copy">
                        A polished fitness experience for tracking activity, joining challenges, and earning real rewards across your community.
                    </p>
                    <div className="hero-features mt-6 inline-grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                        {['Easy onboarding', 'Real prize pools', 'Community-first', 'Smart coaching'].map((item) => (
                            <span key={item} className="chip feature-chip">{item}</span>
                        ))}
                    </div>
                </div>

                <div className="step-panel compact mx-auto mb-8">
                    <div className="step-track" />
                    {steps.map((s) => (
                        <div key={s.n} className={`step-item ${step === s.n || step > s.n ? 'active' : ''}`}>
                            <div className="step-circle">{step > s.n ? '✓' : s.n}</div>
                            <span className="step-label">{s.label}</span>
                        </div>
                    ))}
                </div>

                <div className="page-card mx-auto w-full px-4 sm:px-5 pb-14 fade-up">
                    <div className="landing-card p-7 sm:p-8 shadow-xl">
                        {step === 1 && (
                            <>
                                <div className="mb-6">
                                    <h2 className="serif card-title mb-2 text-offgray">Enter your number</h2>
                                    <p className="card-copy">You'll receive an OTP via SMS or WhatsApp.</p>
                                </div>
                                <input
                                    className="fit-input mb-4"
                                    type="tel"
                                    placeholder="+234 803 123 4567"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    autoComplete="tel"
                                />
                                {error && <div className="error-message mb-3">{error}</div>}
                                <button
                                    className="btn-accent w-full py-4 rounded-3xl text-sm font-semibold uppercase tracking-[0.08em]"
                                    onClick={handleSendOtp}
                                    disabled={loading}
                                >
                                    {loading ? <><span className="loading-spinner"></span> Sending OTP…</> : 'Send OTP →'}
                                </button>
                                <p className="form-note">By continuing you agree to our terms. Your 1-month free trial starts immediately.</p>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <div className="mb-6">
                                    <h2 className="serif card-title mb-2 text-offgray">Enter your OTP</h2>
                                    <p className="card-copy">Sent to <strong>{phone}</strong>.</p>
                                </div>
                                <input
                                    className="fit-input mb-4 text-center text-2xl tracking-[0.25em]"
                                    type="text"
                                    maxLength={6}
                                    placeholder="••••••"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                                {error && <div className="error-message mb-3">{error}</div>}
                                <button className="btn-accent w-full py-4 rounded-3xl text-sm font-semibold uppercase tracking-[0.08em]" onClick={handleVerifyOtp} disabled={loading}>
                                    {loading ? 'Verifying…' : 'Verify OTP'}
                                </button>
                                <button className="btn-ghost w-full py-3 rounded-3xl text-sm mt-4" onClick={() => { setStep(1); setError(''); setOtp(''); }}>
                                    ← Back
                                </button>
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <div className="mb-6">
                                    <h2 className="serif card-title mb-2 text-offgray">Create your profile</h2>
                                    <p className="card-copy">Almost there — tell us your display name and area.</p>
                                </div>
                                <label className="form-label">Display name</label>
                                <input
                                    className="fit-input mb-4"
                                    type="text"
                                    placeholder="e.g. Ada Wuse"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoComplete="name"
                                />
                                <label className="form-label">Location</label>
                                <select
                                    className="fit-input mb-5"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    style={{ appearance: 'none', cursor: 'pointer' }}
                                >
                                    <option value="">— Select your area —</option>
                                    <optgroup label="Abuja">
                                        {['maitama', 'wuse', 'garki', 'asokoro', 'apo', 'lokogoma', 'guzape', 'lugbe', 'kubwa'].map((l) => (
                                            <option key={l} value={l}>{locationLabel(l)}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Extended Regions">
                                        <option value="lagos">Lagos</option>
                                        <option value="port_harcourt">Port Harcourt</option>
                                    </optgroup>
                                </select>
                                {error && <div className="error-message mb-3">{error}</div>}
                                <button className="btn-accent w-full py-4 rounded-3xl text-sm font-semibold uppercase tracking-[0.08em]" onClick={handleCreateProfile} disabled={loading}>
                                    {loading ? 'Creating…' : 'Create Account & Start Trial'}
                                </button>
                            </>
                        )}
                    </div>

                    {step === 1 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-6">
                            {['1-month free trial', '₦15k/month after', 'Win real prize money', 'No biometrics needed'].map((f) => (
                                <span key={f} className="chip">{f}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ChallengesTab() {
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(null);
    const [challenges, setChallenges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchChallenges();
    }, [filter]);

    const fetchChallenges = async () => {
        setLoading(true);
        setError('');
        try {
            const endpoint = filter === 'all' ? '/challenges' : `/challenges?status=${filter}`;
            const data = await apiCall(endpoint);
            setChallenges(data || []);
        } catch (e) {
            setError(`Failed to load challenges: ${e.message}`);
            setChallenges([]);
        } finally {
            setLoading(false);
        }
    };

    if (selected) {
        return <ChallengeDetail ch={selected} onBack={() => setSelected(null)} />;
    }

    const filtered = filter === 'all' ? challenges : challenges.filter((c) => c.status === filter);

    return (
        <div className="fade-up content-panel">
            {currentUser?.status === 'trial_active' && (
                <div className="panel-card" style={{ background: 'linear-gradient(135deg,#fff7f2,#fff0eb)' }}>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <span className="text-3xl">🎉</span>
                        <div>
                            <p className="font-semibold text-sm text-offgray">Your free trial is active!</p>
                            <p className="section-note">Explore challenges now. Upgrade to Pro after 30 days for ₦15,000/month.</p>
                        </div>
                        <button className="btn-accent px-4 py-2 rounded-3xl text-xs font-semibold ml-auto flex-shrink-0">Upgrade</button>
                    </div>
                </div>
            )}

            <div className="panel-card">
                <div className="section-heading">
                    <h2>Challenges</h2>
                    <span className="section-note">{challenges.length} total</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                    {['all', 'active', 'upcoming', 'settled'].map((f) => (
                        <button key={f} className={`nav-pill whitespace-nowrap ${filter === f ? 'active' : ''}`} style={{ fontSize: 13 }} onClick={() => setFilter(f)}>
                            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                {error && <div className="error-message mb-4">{error}</div>}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block loading-spinner" style={{ borderWidth: '3px', width: '32px', height: '32px' }} />
                        <p className="section-note mt-3">Loading challenges...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12"><p className="section-note">No challenges found</p></div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {filtered.map((ch) => (<ChallengeCard key={ch.id} ch={ch} onClick={setSelected} />))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ChallengeDetail({ ch, onBack }) {
    const [joined, setJoined] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchLeaderboard();
    }, [ch.id]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await apiCall(`/leaderboard/${ch.id}`);
            setLeaderboard(data || []);
        } catch (e) {
            setError(`Failed to load leaderboard: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-up content-panel">
            <button className="btn-ghost px-4 py-2 rounded-3xl text-sm mb-5 flex items-center gap-1" onClick={onBack}>← Back to Challenges</button>
            <div className="panel-card mb-5">
                <div className="flex items-start gap-3 mb-4">
                    <span className="text-4xl">{activityIcon(ch.activity_type)}</span>
                    <div>
                        <h2 className="serif text-2xl text-offgray leading-tight">{ch.title}</h2>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className={`badge ${{ active: 'badge-active', upcoming: 'badge-upcoming', verification: 'badge-trial', settled: 'badge-settled' }[ch.status] || ''}`}>
                                {{ active: 'Live', upcoming: 'Upcoming', verification: 'In Review', settled: 'Settled' }[ch.status] || ch.status}
                            </span>
                            {ch.location_scope && <span className="chip">📍 {locationLabel(ch.location_scope)}</span>}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    {[
                        { label: 'Prize Pool', value: ch.prize_pool > 0 ? fmtNaira(ch.prize_pool) : 'Community', highlight: true },
                        { label: 'Entry Fee', value: ch.entry_fee > 0 ? fmtNaira(ch.entry_fee) : 'Free' },
                        { label: 'Participants', value: ch.participants },
                    ].map((m) => (
                        <div key={m.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(201,223,240,0.25)' }}>
                            <div className="text-xs text-faint mb-1">{m.label}</div>
                            <div className={`font-bold text-base ${m.highlight ? 'text-accent' : 'text-offgray'}`}>{m.value}</div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 mt-5">
                    {ch.status !== 'settled' && (
                        <button className="btn-accent flex-1 py-3 rounded-xl text-sm font-semibold" onClick={() => setJoined(true)}>
                            {joined ? '✓ Joined!' : ch.entry_fee > 0 ? `Join · ${fmtNaira(ch.entry_fee)}` : 'Join Challenge'}
                        </button>
                    )}
                    <button className="btn-ghost flex-1 py-3 rounded-xl text-sm font-semibold">Share</button>
                </div>
            </div>
            <div className="panel-card">
                <h3 className="serif text-lg text-offgray mb-4">Leaderboard</h3>
                {error && <div className="error-message mb-4">{error}</div>}
                {loading ? (
                    <div className="text-center py-8"><div className="inline-block loading-spinner" style={{ borderWidth: '3px', width: '24px', height: '24px' }} /></div>
                ) : leaderboard.length === 0 ? (
                    <p className="text-muted text-sm">No entries yet</p>
                ) : (
                    <div className="space-y-3">
                        {leaderboard.slice(0, 10).map((entry) => (
                            <div key={entry.user_id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(201,223,240,0.15)' }}>
                                <div className="flex items-center gap-3">
                                    <Rank n={entry.rank} />
                                    <Avatar label={entry.avatar} size={32} />
                                    <div>
                                        <p className="text-sm font-semibold text-offgray">{entry.user_name}</p>
                                        <p className="text-xs text-muted">{fmt(entry.steps)} steps</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="lboard-bar" style={{ width: 60 }}>
                                        <div className="lboard-bar-fill" style={{ width: `${(entry.steps / (leaderboard[0]?.steps || 1)) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function LeaderboardTab() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchGlobalLeaderboard();
    }, []);

    const fetchGlobalLeaderboard = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await apiCall('/users');
            setLeaderboard(data || []);
        } catch (e) {
            setError(`Failed to load leaderboard: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-up content-panel">
            <div className="panel-card">
                <div className="section-heading">
                    <h2>Global Leaderboard</h2>
                    <span className="section-note">Top performers by total steps</span>
                </div>

                {error && <div className="error-message mb-4">{error}</div>}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block loading-spinner" style={{ borderWidth: '3px', width: '32px', height: '32px' }} />
                        <p className="section-note mt-3">Loading leaderboard...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {leaderboard.map((user, idx) => (
                            <div key={user.id} className="panel-card flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <Rank n={idx + 1} />
                                    <Avatar label={user.avatar} size={40} />
                                    <div>
                                        <p className="font-semibold text-offgray">{user.display_name}</p>
                                        <p className="section-note">{locationLabel(user.location)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-accent text-lg">{fmt(user.steps_total)}</p>
                                    <p className="section-note">steps</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function LogWorkoutTab({ onLog }) {
    const [challenge, setChallenge] = useState('');
    const [activity, setActivity] = useState('steps');
    const [duration, setDuration] = useState('');
    const [steps, setSteps] = useState('');
    const [distance, setDistance] = useState('');
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [challenges, setChallenges] = useState([]);
    const [loadingChallenges, setLoadingChallenges] = useState(true);

    useEffect(() => {
        fetchChallengesForLog();
    }, []);

    const fetchChallengesForLog = async () => {
        setLoadingChallenges(true);
        try {
            const data = await apiCall('/challenges?status=active');
            setChallenges(data || []);
        } catch (e) {
            console.error('Failed to load challenges:', e.message);
            setChallenges([]);
        } finally {
            setLoadingChallenges(false);
        }
    };

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setFileName(f.name);
        }
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');

        if (!activity) {
            setError('Please select an activity type.');
            return;
        }
        if (!duration || parseInt(duration, 10) <= 0) {
            setError('Please enter a valid duration.');
            return;
        }
        if (steps === '' || parseInt(steps, 10) < 0) {
            setError('Please enter valid steps.');
            return;
        }
        if (activity === 'cycling' && (!distance || parseFloat(distance) <= 0)) {
            setError('Please enter a valid distance for cycling.');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (currentUser?.id) {
                formData.append('user_id', currentUser.id);
            }
            if (challenge) {
                formData.append('challenge_id', challenge);
            }
            formData.append('activity_type', activity);
            formData.append('duration_minutes', parseInt(duration, 10).toString());
            formData.append('steps', parseInt(steps, 10).toString());
            if (distance) {
                formData.append('distance_km', parseFloat(distance).toString());
            }
            if (file) {
                formData.append('proof_image', file);
            }

            const response = await fetch(API_BASE + '/activities/log', {
                method: 'POST',
                headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.detail || result?.message || 'Failed to log workout');
            }

            setSuccess('Workout logged successfully! 🎉');
            setChallenge('');
            setActivity('steps');
            setDuration('');
            setSteps('');
            setDistance('');
            setFile(null);
            setFileName('');

            if (currentUser?.id) {
                try {
                    userActivities = await apiCall(`/activities/user/${currentUser.id}`);
                } catch (refreshError) {
                    console.warn('Unable to refresh activities after log:', refreshError.message);
                }
            }

            setTimeout(() => {
                setSuccess('');
                if (typeof onLog === 'function') {
                    onLog();
                }
            }, 2000);
        } catch (e) {
            setError(`Error logging workout: ${e.message || e}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fade-up max-w-2xl content-panel mx-auto">
            <div className="panel-card">
                <div className="section-heading">
                    <h2>Log Your Workout</h2>
                    <span className="section-note">Add steps, cardio, or cycling sessions with proof.</span>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-semibold text-muted block mb-2">Activity Type</label>
                        <div className="grid grid-cols-3 gap-3">
                            {['steps', 'running', 'cycling'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setActivity(type)}
                                    className="p-3 rounded-xl border-2 transition-all text-center"
                                    style={{
                                        borderColor: activity === type ? '#ff5b1f' : '#c9dff0',
                                        background: activity === type ? '#fff0eb' : 'transparent',
                                        color: activity === type ? '#ff5b1f' : '#5a5a5a',
                                    }}
                                >
                                    <span className="text-2xl block mb-1">{activityIcon(type)}</span>
                                    <span className="text-xs font-semibold capitalize">{type}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted block mb-2">Challenge (Optional)</label>
                        <select
                            className="fit-input"
                            value={challenge}
                            onChange={(e) => setChallenge(e.target.value)}
                            style={{ appearance: 'none', cursor: 'pointer' }}
                            disabled={loadingChallenges}
                        >
                            <option value="">— Select a challenge —</option>
                            {challenges.map((ch) => (
                                <option key={ch.id} value={ch.id}>{ch.title}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted block mb-2">Duration (minutes)</label>
                        <input
                            type="number"
                            className="fit-input"
                            placeholder="30"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            min="1"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted block mb-2">Steps</label>
                        <input
                            type="number"
                            className="fit-input"
                            placeholder="5000"
                            value={steps}
                            onChange={(e) => setSteps(e.target.value)}
                            min="0"
                        />
                    </div>

                    {activity === 'cycling' && (
                        <div>
                            <label className="text-xs font-semibold text-muted block mb-2">Distance (km)</label>
                            <input
                                type="number"
                                className="fit-input"
                                placeholder="5.5"
                                value={distance}
                                onChange={(e) => setDistance(e.target.value)}
                                min="0"
                                step="0.1"
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-muted block mb-2">Proof Image (Optional)</label>
                        <div className="border-2 border-dashed border-sky-mid rounded-xl p-4 text-center cursor-pointer hover:border-accent transition-colors">
                            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="proof-file" />
                            <label htmlFor="proof-file" style={{ cursor: 'pointer', display: 'block' }}>
                                {fileName ? (
                                    <>
                                        <span className="text-lg">✓</span>
                                        <p className="text-xs text-muted mt-1">{fileName}</p>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-2xl block mb-1">📸</span>
                                        <p className="text-xs text-muted">Click to upload proof image</p>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">{success}</div>}

                    <button
                        className="btn-accent w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <span className="loading-spinner"></span>
                                Logging workout…
                            </>
                        ) : '✓ Log Workout'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CoachTab() {
    const [messages, setMessages] = useState([
        {
            type: 'ai',
            text: "Hey! I'm your AI fitness coach. Ask me anything about workouts, nutrition, or fitness goals! 💪",
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { type: 'user', text: userMessage }]);
        setLoading(true);

        try {
            const data = await apiCall('/ai/chat', {
                method: 'POST',
                body: { message: userMessage },
            });
            setMessages((prev) => [...prev, { type: 'ai', text: data.reply }]);
        } catch (e) {
            setMessages((prev) => [...prev, { type: 'ai', text: 'Sorry, I’m having trouble responding. Please try again.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-up max-w-2xl content-panel mx-auto">
            <div className="panel-card flex flex-col h-[600px] gap-4">
                <div className="section-heading">
                    <h2>AI Coach</h2>
                    <span className="section-note">Ask anything about workouts, recovery, or nutrition.</span>
                </div>
                <div className="glass rounded-2xl flex-1 p-4 overflow-y-auto mb-0 space-y-3">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={msg.type === 'user' ? 'bubble-user' : 'bubble-ai'}>{msg.text}</div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bubble-ai">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="fit-input"
                        placeholder="Ask me anything..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        disabled={loading}
                    />
                    <button className="btn-accent px-6 py-3 rounded-xl text-sm font-semibold" onClick={handleSend} disabled={loading || !input.trim()}>
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

function ProfileTab({ onLogout }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (currentUser?.id) {
            fetchUserActivities();
        }
    }, [currentUser?.id]);

    const fetchUserActivities = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await apiCall(`/activities/user/${currentUser.id}`);
            setActivities(data || []);
        } catch (e) {
            setError(`Failed to load activities: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-up max-w-2xl content-panel mx-auto">
            <div className="panel-card">
                <div className="flex items-start justify-between mb-4 gap-4">
                    <div className="flex items-center gap-4">
                        <Avatar label={currentUser?.avatar} size={60} />
                        <div>
                            <h2 className="serif text-2xl text-offgray">{currentUser?.display_name}</h2>
                            <p className="text-sm text-muted">{locationLabel(currentUser?.location)}</p>
                            <span className={`badge mt-2 ${currentUser?.status === 'trial_active' ? 'badge-trial' : 'badge-active'}`}>
                                {currentUser?.status === 'trial_active' ? 'Trial' : 'Pro'}
                            </span>
                        </div>
                    </div>
                    <button className="btn-ghost px-4 py-2 rounded-xl text-sm" onClick={() => { clearAuth(); onLogout(); }}>
                        Logout
                    </button>
                </div>
                <div className="divider my-4"></div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-faint mb-1">Total Steps</p>
                        <p className="font-bold text-2xl text-accent">{fmt(currentUser?.steps_total)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-faint mb-1">Phone</p>
                        <p className="font-semibold text-sm text-offgray">{currentUser?.phone}</p>
                    </div>
                </div>
            </div>

            <div className="panel-card">
                <h3 className="serif text-lg text-offgray mb-4">Recent Activities</h3>
                {error && <div className="error-message mb-4">{error}</div>}
                {loading ? (
                    <div className="text-center py-8"><div className="inline-block loading-spinner" style={{ borderWidth: '3px', width: '24px', height: '24px' }} /></div>
                ) : activities.length === 0 ? (
                    <p className="text-muted text-sm">No activities logged yet</p>
                ) : (
                    <div className="space-y-3">
                        {activities.slice(0, 10).map((act) => (
                            <div key={act.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(201,223,240,0.15)' }}>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{activityIcon(act.activity_type)}</span>
                                    <div>
                                        <p className="text-sm font-semibold text-offgray capitalize">{act.activity_type}</p>
                                        <p className="text-xs text-muted">{formatRelativeTime(act.created_at)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-accent">{fmt(act.steps)}</p>
                                    <p className="text-xs text-faint">{act.duration_minutes} min</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="panel-card">
                <h3 className="serif text-lg text-offgray mb-3">Support the Mission</h3>
                <p className="text-sm text-muted mb-4">Help us keep FitNaija running. Every tip helps!</p>
                <button className="btn-accent w-full py-3 rounded-xl text-sm font-semibold">Send a Tip 💝</button>
            </div>
        </div>
    );
}

function AppShell({ onLogout }) {
    const [tab, setTab] = useState('challenges');

    const navItems = [
        { id: 'challenges', icon: '🏆', label: 'Challenges' },
        { id: 'leaderboard', icon: '📊', label: 'Leaderboard' },
        { id: 'log', icon: '➕', label: 'Log Workout' },
        { id: 'coach', icon: '🤖', label: 'AI Coach' },
        { id: 'profile', icon: '👤', label: 'Profile' },
    ];

    return (
        <div className="chrome-bg min-h-screen page-center">
            <header className="glass sticky top-0 z-40 app-header" style={{ borderBottom: '1px solid rgba(201,223,240,0.5)' }}>
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="brand-mark">F</div>
                        <div>
                            <span className="serif text-xl text-offgray">FitNaija</span>
                            <p className="section-note text-sm mt-1">Fitness challenges, rewards and AI support.</p>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 flex-wrap justify-center">
                        {navItems.map((n) => (
                            <button key={n.id} className={`nav-pill ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
                                {n.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`badge ${currentUser?.status === 'trial_active' ? 'badge-trial' : 'badge-active'}`}>
                            {currentUser?.status === 'trial_active' ? 'Trial' : 'Pro'}
                        </span>
                        <Avatar label={currentUser?.avatar || 'U'} size={34} />
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 content-panel">
                {tab === 'challenges' && <ChallengesTab />}
                {tab === 'leaderboard' && <LeaderboardTab />}
                {tab === 'log' && <LogWorkoutTab onLog={() => setTab('challenges')} />}
                {tab === 'coach' && <CoachTab />}
                {tab === 'profile' && <ProfileTab onLogout={onLogout} />}
            </main>

            <nav className="md:hidden glass sticky bottom-0 z-40 bottom-nav" style={{ borderTop: '1px solid rgba(201,223,240,0.5)' }}>
                <div className="flex justify-between items-center bottom-nav-bar">
                    {navItems.map((n) => (
                        <button
                            key={n.id}
                            onClick={() => setTab(n.id)}
                            className={`bottom-nav-btn ${tab === n.id ? 'active' : ''}`}
                        >
                            <span className="text-xl">{n.icon}</span>
                            <span className="bottom-nav-label">{n.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
}

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(!!currentUser);

    const handleLogin = () => setIsLoggedIn(true);
    const handleLogout = () => {
        clearAuth();
        setIsLoggedIn(false);
    };

    return isLoggedIn ? <AppShell onLogout={handleLogout} /> : <LandingScreen onLogin={handleLogin} />;
}

export default App;

