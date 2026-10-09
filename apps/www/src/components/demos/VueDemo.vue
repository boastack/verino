<script setup lang="ts">
import { ref } from 'vue'
import { useOTP } from '@verino/vue'

const verified = ref(false)

const otp = useOTP({
  length: 6,
  autoFocus: false,
  onComplete: () => {
    verified.value = true
  },
})

function resetDemo() {
  otp.reset()
  verified.value = false
}
</script>

<template>
  <div class="flex flex-col items-center gap-5">
    <div class="relative inline-flex flex-wrap justify-center gap-1.5 sm:gap-2.5">
      <input
        v-bind="otp.hiddenInputAttrs.value"
        :ref="(el) => (otp.inputRef.value = el as HTMLInputElement)"
        class="absolute inset-0 z-10 opacity-0"
        aria-label="Verification code"
      />
      <div
        v-for="slot in otp.getSlots()"
        :key="slot.index"
        class="flex h-11 w-9 items-center justify-center rounded-xl border font-mono text-lg font-semibold text-ink-900 transition-all duration-150 sm:h-14 sm:w-11 sm:text-xl"
        :class="[
          slot.isActive ? 'border-brand bg-white shadow-glow scale-105' : 'border-ink-200 bg-ink-50',
          slot.isFilled ? 'bg-white' : '',
        ]"
      >
        {{ slot.value }}
      </div>
    </div>
    <button
      v-if="verified"
      @click="resetDemo"
      class="rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-dim transition hover:bg-brand-100 active:scale-95"
    >
      Verified. Reset demo
    </button>
    <p v-else class="text-sm text-ink-500">Type any 6 digits</p>
  </div>
</template>
