import React, { useState, useEffect } from "react";

const T = {
  bg:     "#000d02",
  green:  "#00ff41",
  g2:     "#22c55e",
  g3:     "#00aa2a",
  dim:    "#0d2d0d",
  muted:  "#1a4a1a",
  text:   "#4ade80",
  red:    "#ef4444",
  yellow: "#facc15",
};

function MatrixRain() {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
      overflow: "hidden", opacity: 0.07,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(
          0deg, transparent, transparent 2px,
          ${T.green} 2px, ${T.green} 3px
        )`,
        animation: "scanDown 8s linear infinite",
      }}/>
    </div>
  );
}

function TypedLine({ text, delay = 0, color = T.text, size = 10 }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        setShown(text.slice(0, ++i));
        if (i >= text.length) clearInterval(iv);
      }, 18);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [text, delay]);
  return <div style={{ fontSize: size, color, fontFamily: "'Courier New',monospace", lineHeight: 1.6 }}>{shown}<span style={{ animation: "blink 0.7s step-end infinite", opacity: shown.length < text.length ? 1 : 0 }}>█</span></div>;
}

const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24">
    <path fill="#4ade80" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#4ade80" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#4ade80" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#4ade80" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function AuthScreen({ onSignIn, onSignUp, onOAuth, authError }) {
  const [mode,     setMode]     = useState("LOGIN"); // LOGIN | REGISTER
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [busy,     setBusy]     = useState(false);
  const [oauthBusy, setOauthBusy] = useState(null);
  const [localErr, setLocalErr] = useState("");
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 2200);
    return () => clearTimeout(t);
  }, []);

  const err = authError || localErr;

  const handleSubmit = async e => {
    e.preventDefault();
    setLocalErr("");
    if (!email.trim() || !password.trim()) { setLocalErr("ALL FIELDS REQUIRED"); return; }
    if (mode === "REGISTER" && password.length < 8) { setLocalErr("PASSWORD MINIMUM 8 CHARACTERS"); return; }
    setBusy(true);
    let ok;
    if (mode === "LOGIN") ok = await onSignIn(email, password);
    else ok = await onSignUp(email, password, name);
    setBusy(false);
    if (!ok && !authError) setLocalErr("ACCESS DENIED — CHECK CREDENTIALS");
  };

  const inp = {
    width: "100%", background: "rgba(0,20,8,.7)", color: T.green,
    border: `1px solid ${T.muted}`, borderRadius: 6,
    padding: "13px 14px", fontSize: 14, fontFamily: "'Courier New',monospace",
    outline: "none", letterSpacing: 1,
    boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: T.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New',monospace", zIndex: 9999,
      padding: "16px",
    }}>
      <MatrixRain />

      {/* Corner brackets */}
      {[
        { top:20, left:20, borderTop:`1px solid ${T.g3}`, borderLeft:`1px solid ${T.g3}` },
        { top:20, right:20, borderTop:`1px solid ${T.g3}`, borderRight:`1px solid ${T.g3}` },
        { bottom:20, left:20, borderBottom:`1px solid ${T.g3}`, borderLeft:`1px solid ${T.g3}` },
        { bottom:20, right:20, borderBottom:`1px solid ${T.g3}`, borderRight:`1px solid ${T.g3}` },
      ].map((s, i) => (
        <div key={i} style={{ position:"fixed", width:40, height:40, pointerEvents:"none", ...s }}/>
      ))}

      <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:440 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:40, marginBottom:8, filter:`drop-shadow(0 0 20px ${T.green})` }}>🛡️</div>
          <div style={{ fontSize:22, fontWeight:700, color:T.green, letterSpacing:6, textShadow:`0 0 20px ${T.green}66` }}>BRCS</div>
          <div style={{ fontSize:9, color:T.g3, letterSpacing:4, marginTop:2 }}>BHARAT RAKSHA COMMAND SYSTEM</div>
          <div style={{ fontSize:8, color:T.muted, letterSpacing:3, marginTop:6, padding:"3px 12px", border:`1px solid ${T.muted}`, display:"inline-block", borderRadius:2 }}>
            CLASSIFICATION: TOP SECRET TS/SCI
          </div>
        </div>

        {/* Boot sequence */}
        {!bootDone ? (
          <div style={{ background:"rgba(0,12,4,.85)", border:`1px solid ${T.dim}`, borderRadius:4, padding:20 }}>
            <TypedLine text="► INITIALIZING SECURE CHANNEL..." delay={0}   size={11}/>
            <TypedLine text="► ESTABLISHING ENCRYPTED LINK..."  delay={400}  size={11}/>
            <TypedLine text="► LOADING TACTICAL DATABASE..."    delay={900}  size={11}/>
            <TypedLine text="► SYSTEM READY — AUTHENTICATE."   delay={1600} size={11} color={T.green}/>
          </div>
        ) : (

        <div style={{ background:"rgba(0,12,4,.9)", border:`1px solid ${T.dim}`, borderRadius:4, overflow:"hidden", boxShadow:`0 0 40px ${T.green}11` }}>

          {/* Title bar */}
          <div style={{
            background:"rgba(0,20,8,.6)", borderBottom:`1px solid ${T.dim}`,
            padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span style={{ fontSize:9, color:T.g3, letterSpacing:2, fontWeight:700 }}>
              {mode === "LOGIN" ? "SECURE AUTH TERMINAL" : "OPERATOR REGISTRATION"}
            </span>
            <div style={{ display:"flex", gap:4 }}>
              {["LOGIN","REGISTER"].map(m => (
                <button key={m} onClick={()=>{ setMode(m); setLocalErr(""); }} style={{
                  background: mode===m ? `${T.green}18` : "transparent",
                  border: `1px solid ${mode===m ? T.green : T.muted}`,
                  color: mode===m ? T.green : T.muted,
                  borderRadius:2, padding:"2px 10px", fontSize:8, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit", letterSpacing:1,
                }}>{m}</button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ padding:"20px 20px 16px" }}>
            {mode === "REGISTER" && (
              <label style={{ display:"block", marginBottom:12 }}>
                <div style={{ fontSize:10, color:T.muted, letterSpacing:2, marginBottom:6 }}>OPERATOR NAME</div>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. COL SHARMA" style={inp} autoComplete="name"/>
              </label>
            )}
            <label style={{ display:"block", marginBottom:12 }}>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:2, marginBottom:6 }}>OPERATOR ID (EMAIL)</div>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@mil.in" required style={inp} autoComplete="username"/>
            </label>
            <label style={{ display:"block", marginBottom:16 }}>
              <div style={{ fontSize:10, color:T.muted, letterSpacing:2, marginBottom:6 }}>ACCESS CODE</div>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••••••" required style={inp} autoComplete="current-password"/>
            </label>

            {err && (
              <div style={{
                background:"rgba(239,68,68,.08)", border:`1px solid #ef444433`,
                borderRadius:3, padding:"8px 12px", marginBottom:12,
                fontSize:9, color:T.red, letterSpacing:0.5, fontWeight:700,
              }}>⚠ {err}</div>
            )}

            <button type="submit" disabled={busy} style={{
              width:"100%", background: busy ? T.dim : `linear-gradient(135deg,${T.muted},#0d3a0d)`,
              border:`1px solid ${busy ? T.muted : T.g2}`, borderRadius:8,
              padding:"15px", fontSize:13, fontWeight:700, cursor: busy ? "not-allowed" : "pointer",
              fontFamily:"inherit", color: busy ? T.muted : T.green,
              letterSpacing:3, transition:"all .2s",
              textShadow: busy ? "none" : `0 0 10px ${T.green}66`,
              minHeight:50,
            }}>
              {busy ? "⟳ AUTHENTICATING..." : mode === "LOGIN" ? "▶ AUTHENTICATE" : "▶ REQUEST ACCESS"}
            </button>
          </form>

          {/* OAuth buttons */}
          <div style={{ padding:"0 20px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div style={{ flex:1, height:1, background:T.dim }}/>
              <span style={{ fontSize:7, color:T.muted, letterSpacing:2 }}>OR AUTHENTICATE VIA</span>
              <div style={{ flex:1, height:1, background:T.dim }}/>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {[
                { provider:"github", label:"GITHUB", Icon:GithubIcon },
                { provider:"google", label:"GOOGLE", Icon:GoogleIcon },
              ].map(({ provider, label, Icon }) => (
                <button key={provider} type="button"
                  disabled={!!oauthBusy}
                  onClick={async () => { setOauthBusy(provider); await onOAuth(provider); setOauthBusy(null); }}
                  style={{
                    flex:1, background:"rgba(0,20,8,.6)",
                    border:`1px solid ${oauthBusy===provider ? T.green : T.muted}`, borderRadius:8,
                    padding:"13px", fontSize:11, fontWeight:700,
                    cursor: oauthBusy ? "not-allowed" : "pointer", fontFamily:"inherit",
                    color:T.text, letterSpacing:2,
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    transition:"border-color .2s", opacity: oauthBusy && oauthBusy!==provider ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!oauthBusy) e.currentTarget.style.borderColor = T.green; }}
                  onMouseLeave={e => { if (oauthBusy!==provider) e.currentTarget.style.borderColor = T.muted; }}
                >
                  {oauthBusy===provider ? "⟳" : <Icon />}
                  {oauthBusy===provider ? " REDIRECTING..." : ` ${label}`}
                </button>
              ))}
            </div>
          </div>

          {/* Warning footer */}
          <div style={{ background:"rgba(0,8,2,.6)", borderTop:`1px solid ${T.dim}`, padding:"8px 16px" }}>
            <div style={{ fontSize:7.5, color:"#1a3a1a", letterSpacing:0.5, lineHeight:1.8, textAlign:"center" }}>
              ⚠ UNAUTHORIZED ACCESS IS A CRIMINAL OFFENSE UNDER IT ACT 2000<br/>
              ALL SESSIONS ARE MONITORED · LOGGED · AUDITED
            </div>
          </div>
        </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }
        @keyframes scanDown { 0%{transform:translateY(-100%)} 100%{transform:translateY(100%)} }
        input::placeholder { color: #1a4a1a !important; }
        input:focus { border-color: #22c55e !important; box-shadow: 0 0 8px #22c55e22 !important; }
      `}</style>
    </div>
  );
}
