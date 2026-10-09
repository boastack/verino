import { useState } from 'react'
import { useOTP } from '@verino/react'

export default function ReactDemo() {
  const [verified, setVerified] = useState(false)
  const otp = useOTP({
    length: 6,
    autoFocus: false,
    onComplete: () => setVerified(true),
  })

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative inline-flex flex-wrap justify-center gap-1.5 sm:gap-2.5">
        <input
          {...otp.hiddenInputProps}
          className="absolute inset-0 z-10 opacity-0"
          aria-label="Verification code"
        />
        {otp.getSlots().map((slot) => {
          const props = otp.getSlotProps(slot.index)
          return (
            <div
              key={slot.index}
              className={[
                'flex h-11 w-9 items-center justify-center rounded-xl border font-mono text-lg font-semibold transition-all duration-150 sm:h-14 sm:w-11 sm:text-xl',
                props.isActive ? 'border-brand bg-white shadow-glow scale-105' : 'border-ink-200 bg-ink-50',
                props.isFilled ? 'bg-white text-ink-900' : 'text-ink-900',
              ].join(' ')}
            >
              {props.char}
            </div>
          )
        })}
      </div>
      {verified ? (
        <button
          onClick={() => {
            otp.reset()
            setVerified(false)
          }}
          className="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-dim transition hover:bg-brand-100 active:scale-95"
        >
          Verified. Reset demo
        </button>
      ) : (
        <p className="text-sm text-ink-500">Type any 6 digits</p>
      )}
    </div>
  )
}
