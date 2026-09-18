<script setup lang="ts">
import { en } from '@nuxt/ui/locale'
import { ConfigProvider } from 'reka-ui'

// Keep the document nonce during client navigation for Reka's dynamic styles.
const nonce = useState('csp-nonce', () => useNonce())
const { subscribe } = await useAuth()
subscribe()
</script>

<template>
  <UApp :locale="en" :toaster="null">
    <ConfigProvider :nonce="nonce" :use-id="() => useId()">
      <NuxtLayout>
        <ClientOnly>
          <NuxtLoadingIndicator color="#0080FF" />
        </ClientOnly>
        <NuxtPage />
      </NuxtLayout>
      <!-- These runtime-only controls set styles through the DOM rather than
           emitting inline style attributes in server-rendered HTML. -->
      <ClientOnly>
        <UToaster />
      </ClientOnly>
    </ConfigProvider>
  </UApp>
</template>
