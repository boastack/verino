<script lang="ts">
  import { useOTP } from '@verino/svelte'

  let verified = false

  const otp = useOTP({
    length: 6,
    autoFocus: false,
    onComplete: () => {
      verified = true
    },
  })

  const { slots } = otp

  function resetDemo() {
    otp.reset()
    verified = false
  }
</script>

<div class="flex flex-col items-center gap-5">
  <div class="relative inline-flex flex-wrap justify-center gap-1.5 sm:gap-2.5">
    <input use:otp.action class="absolute inset-0 z-10 opacity-0" aria-label="Verification code" />
    {#each $slots as slot (slot.index)}
      <div
        class="flex h-11 w-9 items-center justify-center rounded-xl border font-mono text-lg font-semibold text-ink-900 transition-all duration-150 sm:h-14 sm:w-11 sm:text-xl"
        class:border-brand={slot.isActive}
        class:shadow-glow={slot.isActive}
        class:scale-105={slot.isActive}
        class:bg-white={slot.isActive || slot.isFilled}
        class:border-ink-200={!slot.isActive}
        class:bg-ink-50={!slot.isActive && !slot.isFilled}
      >
        {slot.value}
      </div>
    {/each}
  </div>
  {#if verified}
    <button
      on:click={resetDemo}
      class="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-dim transition hover:bg-brand-100 active:scale-95"
    >
      Verified. Reset demo
    </button>
  {:else}
    <p class="text-sm text-ink-500">Type any 6 digits</p>
  {/if}
</div>
