<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
    <UContainer class="py-4">
      <header class="py-4 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2">
          <NuxtImg
            src="/logo.svg"
            alt="Logo"
            class="w-8 h-8"
          />
          <span class="font-bold text-lg">Postgraphile nuxt starter</span>
        </NuxtLink>

        <UColorModeButton />
      </header>

      <main class="flex justify-center items-center min-h-[calc(100vh-160px)]">
        <slot />
      </main>

      <footer class="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>© {{ new Date().getFullYear() }} NuxtUI App. All rights reserved.</p>
      </footer>
    </UContainer>
  </div>
</template>
