<script setup lang="ts">
const {user, isAuthenticated, logout} = await useAuth()

const handleLogout = () => {
  logout()
}
</script>

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
          <span class="font-bold text-lg">Postgraphile Nuxt Starter</span>
        </NuxtLink>

        <div class="flex items-center gap-4">
          <UColorModeButton />

          <template v-if="isAuthenticated">
            <UDropdownMenu
              :items="[[
                {
                  label: 'Create Organization',
                  icon: 'i-heroicons-plus',
                  to: '/create-organization'
                },
                ...(user?.organizationMemberships?.nodes || []).map(membership => ({
                  label: membership.organization?.name,
                  icon: 'i-heroicons-building-office',
                  to: `/o/${membership.organization?.slug}`
                })),
              ],
              [
                {
                  label: 'Settings',
                  icon: 'i-heroicons-user-circle',
                  to: '/settings'
                },
                { divider: true },
                {
                  label: 'Logout',
                  icon: 'i-heroicons-arrow-right-on-rectangle',
                  onSelect: handleLogout
                }
              ]]"
            >
              <UButton
                color="primary"
                variant="soft"
                class="hidden sm:flex"
                icon="i-heroicons-user-circle"
                trailing-icon="i-heroicons-chevron-down"
              >
                {{ user?.name || user?.username }}
              </UButton>
            </UDropdownMenu>

            <UButton
              color="primary"
              variant="ghost"
              icon="i-heroicons-arrow-right-on-rectangle"
              class="sm:hidden"
              @click="handleLogout"
            >
              Logout
            </UButton>
          </template>
        </div>
      </header>

      <main>
        <slot />
      </main>

      <footer class="py-8 mt-12 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>© {{ new Date().getFullYear() }} Postgraphile Nuxt Starter. All rights reserved.</p>
      </footer>
    </UContainer>
  </div>
</template>
