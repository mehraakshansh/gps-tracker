import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position:"fixed", inset:0, background:"#000d02",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'Courier New',monospace", color:"#ef4444",
          padding:40, flexDirection:"column", gap:16,
        }}>
          <div style={{fontSize:28}}>⚠</div>
          <div style={{fontSize:12, fontWeight:700, letterSpacing:2}}>SYSTEM FAULT</div>
          <div style={{
            background:"rgba(239,68,68,.08)", border:"1px solid #ef444433",
            borderRadius:4, padding:"12px 20px", maxWidth:600,
            fontSize:11, color:"#ef4444", lineHeight:1.8, whiteSpace:"pre-wrap",
          }}>{this.state.error?.message || String(this.state.error)}</div>
          <button onClick={()=>window.location.href="/"} style={{
            background:"transparent", border:"1px solid #ef4444",
            color:"#ef4444", borderRadius:3, padding:"8px 20px",
            fontSize:10, cursor:"pointer", fontFamily:"inherit", letterSpacing:2,
          }}>RELOAD</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Hide pre-boot overlay once React takes over
const preboot = document.getElementById("preboot");
if (preboot) preboot.remove();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
