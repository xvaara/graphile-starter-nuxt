<script setup lang="ts">
import { en } from '@nuxt/ui/locale'

useAuthSubscription()
</script>

<template>
  <UApp :locale="en">
    <NuxtLayout>
      <NuxtLoadingIndicator color="#0080FF" />
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
