<!--
  verino — Svelte example

  Demonstrates:
    - useOTP composable + use:action (single hidden-input architecture)
    - $otp.slots derived store for slot iteration
    - getInputProps() data-* attributes for CSS-driven styling
    - Typing, paste, deletion, completion
-->

<script lang="ts">
  import { writable } from 'svelte/store'
  import { useOTP } from '@verino/svelte'

  // Track hidden-input focus for hasFakeCaret rendering. The action wires focus/blur
  // handlers that update data-focus on slot elements, but a local store is the
  // cleanest way to drive the fake-caret condition in the template.
  const isFocused = writable(false)

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

    onFocus: () => isFocused.set(true),
    onBlur:  () => isFocused.set(false),

    onComplete: (code: string) => {
      console.log('Complete:', code)
      otp.setError(code !== '123456')
    },
    onExpire: () => console.log('Expired'),
  })

  // timerSeconds is a live Writable<number> — driven internally by createTimer
  // slots is a Readable<SlotEntry[]> derived store — reactive slot iteration

  const { timerSeconds, separatorAfter, separator, masked, maskChar, placeholder, slots } = otp


  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Extract only data-* entries from getInputProps.
   * Spread these on a visual div to enable CSS attribute selectors.
   */
  function slotDataAttrs(i: number): Record<string, string | number> {
    const props = otp.getInputProps(i)
    const out: Record<string, string | number> = {}
    for (const key in props) {
      if (key.startsWith('data-')) out[key] = (props as Record<string, unknown>)[key] as string | number
    }
    return out
  }

  /** Returns true when a separator should be rendered before slot `i`. */
  function isSeparatorBefore(separatorAfterVal: number | number[], i: number): boolean {
    if (Array.isArray(separatorAfterVal)) return separatorAfterVal.includes(i)
    return separatorAfterVal > 0 && i === separatorAfterVal
  }

  /** Formats remaining seconds as "M:SS". */
  function formatTimer(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
</script>

<div class="form">
  <h2>Enter verification code</h2>
  <p>Enter the 6-digit code sent to <strong>hello@example.com</strong>.</p>

  <!-- ── OTP field ──────────────────────────────────────────────────────── -->
  <!--
    One transparent input captures all events via use:action.
    Slot divs are purely visual — no event handling of their own.
  -->
  <div class="otp-row">
    <input
      use:otp.action
      class="hidden-input"
    />

    <!-- $slots is a reactive derived store — re-renders on every state change -->
    {#each $slots as slot (slot.index)}
      <!-- Separator after configured slot index -->
      {#if isSeparatorBefore($separatorAfter, slot.index)}
        <span class="sep" aria-hidden="true">{$separator}</span>
      {/if}

      <!--
        Slot receives data-* attributes from getInputProps() for CSS-driven styling.
        No inline JS style checks — all states driven by CSS attribute selectors.
      -->
      <div class="slot" {...slotDataAttrs(slot.index)}>
        <!-- Fake blinking caret on active empty slot -->
        {#if slot.isActive && !slot.isFilled && $isFocused}
          <span class="caret" />
        {/if}
        <span>{$masked && slot.value ? $maskChar : slot.value || placeholder}</span>
      </div>
    {/each}
  </div>

  <!-- ── Live timer countdown ───────────────────────────────────────────── -->
  {#if $timerSeconds > 0}
    <p class="timer" class:expiring={$timerSeconds < 10}>
      Expires in {formatTimer($timerSeconds)}
    </p>
  {/if}

  <!-- ── Status messages ───────────────────────────────────────────────── -->
  {#if $otp.hasError}
    <p class="msg error">Incorrect code. Try <strong>123456</strong>.</p>
  {/if}
  {#if $otp.isComplete && !$otp.hasError}
    <p class="msg success">✓ Verified!</p>
  {/if}

  <!-- ── Controls ──────────────────────────────────────────────────────── -->
  <div class="controls">
    <button on:click={otp.reset}>Reset</button>
    <button on:click={() => otp.setError(false)}>Clear error</button>
  </div>

  <!-- ── Debug output ───────────────────────────────────────────────────── -->
  <pre class="debug">{JSON.stringify({
    code:       otp.getCode(),
    slots:      $slots.map(s => ({ i: s.index, v: s.value || '·', active: s.isActive })),
    isComplete: $otp.isComplete,
    hasError:   $otp.hasError,
    timer:      $timerSeconds,
  }, null, 2)}</pre>
</div>

<style>
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

  .otp-row    { position: relative; display: inline-flex; gap: 8px; align-items: center }
  .hidden-input {
    position: absolute; inset: 0; width: 100%; height: 100%;
    opacity: 0; z-index: 1; cursor: text;
    border: none; outline: none; background: transparent; font-size: 1px;
  }
  .sep { color: #A1A1A1; font-size: 18px; padding: 0 2px; user-select: none }

  /* ── Slot base ── */
  .slot {
    position: relative; width: 56px; height: 56px;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid #E5E5E5; border-radius: 10px;
    font-size: 24px; font-weight: 600; font-family: ui-monospace, monospace;
    background: #FAFAFA; color: #0A0A0A;
    transition: border-color 150ms ease, box-shadow 150ms ease;
    user-select: none; cursor: text;
  }

  /* ── data-* driven states ── */
  /* data-active = logical cursor; data-focus = hidden input has browser focus */
  .slot[data-active="true"][data-focus="true"] {
    border-color: #3D3D3D;
    box-shadow: 0 0 0 3px rgba(61,61,61,.10);
  }
  .slot[data-filled="true"]   { background: #FFFFFF }
  .slot[data-complete="true"] {
    border-color: #00C950;
    box-shadow: 0 0 0 3px rgba(0,201,80,.12);
  }
  .slot[data-invalid="true"] {
    border-color: #FB2C36;
    box-shadow: 0 0 0 3px rgba(251,44,54,.12);
  }
  .slot[data-disabled="true"] { opacity: .45; pointer-events: none }
  .slot[data-readonly="true"] { background: #F5F5F5 }

  /* ── First / last radius ── */
  .slot[data-first="true"] { border-radius: 10px 6px 6px 10px }
  .slot[data-last="true"]  { border-radius: 6px 10px 10px 6px }

  /* ── Caret ── */
  .caret {
    position: absolute; width: 2px; height: 52%;
    background: #3D3D3D; border-radius: 1px;
    animation: blink 1s step-start infinite;
  }

  /* ── Utilities ── */
  .form     { font-family: sans-serif; padding: 32px; max-width: 480px }
  .timer    { margin-top: 8px; font-size: 13px; color: #757575 }
  .expiring { color: #FB2C36 }
  .msg      { margin-top: 8px; font-size: 13px }
  .error    { color: #FB2C36 }
  .success  { color: #00C950 }
  .controls { display: flex; gap: 8px; margin-top: 20px }
  .controls button {
    padding: 8px 16px; border-radius: 8px;
    border: 1px solid #E5E5E5; cursor: pointer; font-family: inherit;
  }
  .debug {
    margin-top: 20px; font-size: 12px; color: #757575;
    background: #F5F5F5; padding: 12px; border-radius: 8px;
  }
</style>
