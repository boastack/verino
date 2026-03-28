/**
 * verino — React example
 *
 * Demonstrates:
 *   - useOTP hook + HiddenOTPInput (single hidden-input architecture)
 *   - getSlots() for slot iteration
 *   - getInputProps() data-* attributes for CSS-driven styling
 *   - getSlotProps() for full slot render props (hasFakeCaret, masked, etc.)
 *   - Typing, paste, deletion, completion
 */

import { useOTP, HiddenOTPInput, type SlotRenderProps } from '@verino/react'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract only the data-* entries from getInputProps.
 * Spread these on a visual <div> to enable CSS attribute selectors without
 * putting event handlers on non-interactive elements.
 *
 * Alternatively, spread getInputProps directly onto a per-slot <input>
 * when using the multi-input architecture.
 */
/** Returns true when a separator should be rendered before slot `i`. */
function isSeparatorBefore(separatorAfter: number | number[], i: number): boolean {
  if (Array.isArray(separatorAfter)) return separatorAfter.includes(i)
  return separatorAfter > 0 && i === separatorAfter
}

type DataAttrs = Record<string, string | number>
function dataAttrs(props: Record<string, unknown>): DataAttrs {
  const out: DataAttrs = {}
  for (const key in props) {
    if (key.startsWith('data-')) out[key] = props[key] as string | number
  }
  return out
}

/** Format remaining seconds as M:SS. */
function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}


// ── Slot component ────────────────────────────────────────────────────────────
//
// Styled via className + data-* CSS selectors — no inline state checks.
// See the <style> block at the bottom for the selector rules.

function Slot(props: SlotRenderProps & DataAttrs) {
  const { char, hasFakeCaret, masked, maskChar, placeholder,
          index, isActive, isFilled, isError, isSuccess, isComplete, isDisabled, isFocused,
          ...attrs } = props
  const display = masked && char ? maskChar : char || placeholder

  return (
    <div className="slot" {...attrs}>
      {hasFakeCaret && <span className="caret" />}
      <span>{display}</span>
    </div>
  )
}


// ── Main component ────────────────────────────────────────────────────────────

export default function OTPForm() {
  const otp = useOTP({
    length: 6,
    type:   'numeric',
    timer:  60,

    // Strip common paste formatting: "G-123456" or "123 456" → "123456"
    pasteTransformer: (raw: string) => raw.replace(/[\s-]/g, ''),

    masked:      true,
    maskChar:    '*',
    placeholder: '○',

    separatorAfter: 3,
    separator:      '—',

    onComplete: (code: string) => {
      console.log('Complete:', code)
      otp.setError(code !== '123456')
    },
    onExpire: () => console.log('Expired'),
  })

  return (
    <div className="form">
      <h2>Enter verification code</h2>
      <p>Enter the 6-digit code sent to <strong>hello@example.com</strong>.</p>

      {/* ── OTP field ─────────────────────────────────────────────────────── */}
      {/*
        One transparent <input> sits over the slot row.
        HiddenOTPInput positions itself absolutely to capture all events.
        Slot <div>s are purely visual — no event handling of their own.
      */}
      <div className="otp-row" {...otp.wrapperProps}>
        <HiddenOTPInput {...otp.hiddenInputProps} />

        {otp.getSlots().map((slot: { index: number; value: string }) => (
          <span key={slot.index} style={{ display: 'contents' }}>

            {/* Separator before this slot if separatorAfter targets the previous index */}
            {otp.separatorAfter != null && isSeparatorBefore(otp.separatorAfter, slot.index) && (
              <span className="sep" aria-hidden="true">{otp.separator}</span>
            )}

            {/*
              Slot receives:
                - getSlotProps(i)  → char, isActive, isFilled, hasFakeCaret, masked, …
                - dataAttrs(...)   → data-* attributes from getInputProps(i) for CSS
            */}
            <Slot
              {...otp.getSlotProps(slot.index)}
              {...dataAttrs(otp.getInputProps(slot.index))}
            />
          </span>
        ))}
      </div>

      {/* ── Timer ─────────────────────────────────────────────────────────── */}
      {otp.timerSeconds > 0 && (
        <p className={`timer ${otp.timerSeconds < 10 ? 'expiring' : ''}`}>
          Expires in {formatTimer(otp.timerSeconds)}
        </p>
      )}

      {/* ── Status ────────────────────────────────────────────────────────── */}
      {otp.hasError && (
        <p className="msg error">Incorrect code. Try <strong>123456</strong>.</p>
      )}
      {otp.isComplete && !otp.hasError && (
        <p className="msg success">✓ Verified!</p>
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="controls">
        <button onClick={otp.reset}>Reset</button>
        <button onClick={() => otp.setError(false)}>Clear error</button>
      </div>

      {/* ── Debug ─────────────────────────────────────────────────────────── */}
      <pre className="debug">{JSON.stringify({
        code:       otp.getCode(),
        slots:      otp.getSlots().map((s: { index: number; value: string; isActive: boolean }) => ({ i: s.index, v: s.value || '·', active: s.isActive })),
        isComplete: otp.isComplete,
        hasError:   otp.hasError,
        timer:      otp.timerSeconds,
      }, null, 2)}</pre>

      {/*
        ── Styles ──────────────────────────────────────────────────────────────
        In a real app, move these to a CSS file.
        All slot states are driven by data-* attributes — no JS className toggling.
      */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        .otp-row  { position:relative; display:inline-flex; gap:8px; align-items:center }
        .sep      { color:#A1A1A1; font-size:18px; padding:0 2px; user-select:none }

        /* ── Slot base ── */
        .slot {
          position:relative; width:56px; height:56px;
          display:flex; align-items:center; justify-content:center;
          border:1.5px solid #E5E5E5; border-radius:10px;
          font-size:24px; font-weight:600; font-family:ui-monospace,monospace;
          background:#FAFAFA; color:#0A0A0A;
          transition:border-color 150ms ease, box-shadow 150ms ease;
          user-select:none; cursor:text;
        }

        /* ── data-* driven states ── */
        /* data-active = logical cursor; data-focus = hidden input has browser focus */
        .slot[data-active="true"][data-focus="true"] {
          border-color:#3D3D3D;
          box-shadow:0 0 0 3px rgba(61,61,61,.10);
        }
        .slot[data-filled="true"]   { background:#FFFFFF }
        .slot[data-complete="true"] {
          border-color:#00C950;
          box-shadow:0 0 0 3px rgba(0,201,80,.12);
        }
        .slot[data-invalid="true"]  {
          border-color:#FB2C36;
          box-shadow:0 0 0 3px rgba(251,44,54,.12);
        }
        .slot[data-disabled="true"] { opacity:.45; pointer-events:none }
        .slot[data-readonly="true"] { background:#F5F5F5 }

        /* ── First / last radius ── */
        .slot[data-first="true"] { border-radius:10px 6px 6px 10px }
        .slot[data-last="true"]  { border-radius:6px 10px 10px 6px }

        /* ── Caret ── */
        .caret {
          position:absolute; width:2px; height:52%;
          background:#3D3D3D; border-radius:1px;
          animation:blink 1s step-start infinite;
        }

        /* ── Utilities ── */
        .form    { font-family:sans-serif; padding:32px; max-width:480px }
        .timer   { margin-top:8px; font-size:13px; color:#757575 }
        .expiring{ color:#FB2C36 }
        .msg     { margin-top:8px; font-size:13px }
        .error   { color:#FB2C36 }
        .success { color:#00C950 }
        .controls{ display:flex; gap:8px; margin-top:20px }
        .controls button {
          padding:8px 16px; border-radius:8px;
          border:1px solid #E5E5E5; cursor:pointer; font-family:inherit;
        }
        .debug {
          margin-top:20px; font-size:12px; color:#757575;
          background:#F5F5F5; padding:12px; border-radius:8px;
        }
      `}</style>
    </div>
  )
}
