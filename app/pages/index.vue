<script setup lang="ts">
const { user, isAuthenticated } = await useAuth()

// Composables for email verification status if needed
const _hasUnverifiedEmail = computed(() => user.value?.isVerified === false)
</script>

<template>
  <section class="py-10 md:py-20">
    <div class="max-w-7xl mx-auto px-4">
      <!-- Login/Register buttons -->
      <div v-if="!isAuthenticated" class="flex gap-4 justify-center mb-8">
        <UButton
          to="/login"
          color="primary"
          icon="i-heroicons-arrow-right-on-rectangle"
        >
          Login
        </UButton>
        <UButton
          to="/register"
          variant="outline"
          icon="i-heroicons-user-plus"
        >
          Register
        </UButton>
      </div>

      <div class="grid lg:grid-cols-3 gap-12">
        <div class="lg:col-span-2">
          <div class="prose dark:prose-invert max-w-none">
            <h1 class="text-4xl font-bold mb-6">
              Welcome to the Nuxt GraphQL Starter
            </h1>

            <p class="text-lg mb-6">
              This project serves as a foundation for your own application. We've included many essential features that most projects need, but you're free to modify or remove them as required.
            </p>

            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="warning"
              title="Please read the following sections"
              class="mb-8"
            />

            <h2 class="text-2xl font-semibold mt-8 mb-4">Development Mode Notes</h2>
            <div class="space-y-6">
              <div>
                <h3 class="text-xl font-medium mb-2">Page Load Times in Development</h3>
                <p>
                  In development mode, initial page loads might take longer due to on-demand compilation. This delay is significantly reduced in production builds with proper optimization and pre-fetching.
                </p>
              </div>

              <div>
                <h3 class="text-xl font-medium mb-2">Email Handling</h3>
                <p>
                  During development, emails are not sent to real addresses. Instead, they are captured by
                  <ULink href="http://ethereal.email" external>ethereal.email</ULink>.
                  Check your terminal for preview URLs when emails are triggered.
                </p>
              </div>

              <div>
                <h3 class="text-xl font-medium mb-2">GraphQL Playground</h3>
                <p>
                  Explore and test the GraphQL API using the built-in playground at
                  <ULink href="/api/ruru" external>GraphQL Playground</ULink>.
                </p>
              </div>
            </div>

            <h2 class="text-2xl font-semibold mt-12 mb-4">Getting Started</h2>
            <div class="space-y-6">
              <div>
                <h3 class="text-xl font-medium mb-2">Database Migrations</h3>
                <p>
                  We use <code>graphile-migrate</code> for database management. The initial migration sets up the user system.
                  To customize it, run <code>yarn db uncommit</code> to move its content to current.sql.
                </p>
              </div>

              <div>
                <h3 class="text-xl font-medium mb-2">Next Steps</h3>
                <ul class="mt-4 space-y-2 list-disc pl-4">
                  <li>Click "Sign In" above to create a new account</li>
                  <li>Explore the GraphQL Playground to understand the API</li>
                  <li>Check current.sql for database structure</li>
                  <li>Review the documentation in the README</li>
                </ul>
              </div>
            </div>

            <h2 class="text-2xl font-semibold mt-12 mb-4">Production Considerations</h2>
            <div class="space-y-6">
              <div>
                <h3 class="text-xl font-medium mb-2">Security</h3>
                <p>
                  Before deploying to production, ensure you've implemented proper security measures:
                </p>
                <ul class="mt-4 space-y-2 list-disc pl-4">
                  <li>Configure proper CORS settings</li>
                  <li>Set up rate limiting</li>
                  <li>Implement proper authentication checks</li>
                  <li>Review GraphQL query complexity limits</li>
                </ul>
              </div>

              <div>
                <h3 class="text-xl font-medium mb-2">Email Configuration</h3>
                <p>
                  The project is configured to use Amazon SES in production. You'll need to set up the appropriate credentials
                  and environment variables.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <UCard>
            <template #header>
              <h3 class="text-xl font-semibold">Support the Project</h3>
            </template>

            <div class="space-y-4">
              <p>
                If this starter kit has helped you, consider supporting its development. Your contribution helps maintain and improve the project.
              </p>

              <p class="font-medium">
                Every contribution makes a difference in keeping this project active and evolving.
              </p>

              <UButton
                to="https://github.com/sponsors/flow-tools"
                target="_blank"
                color="primary"
                block
                icon="i-heroicons-heart"
              >
                Sponsor This Project
              </UButton>
            </div>
          </UCard>

          <UCard class="mt-6">
            <template #header>
              <h3 class="text-xl font-semibold">Quick Links</h3>
            </template>

            <ul class="space-y-2">
              <li>
                <ULink href="https://nuxt.com/docs" external>Documentation</ULink>
              </li>
              <li>
                <ULink href="/api/ruru" external>GraphQL Playground</ULink>
              </li>
              <li>
                <ULink href="https://github.com/xvaara/project" external>GitHub Repository</ULink>
              </li>
            </ul>
          </UCard>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.prose {
  max-width: none;
}

/* Fade in animation */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.prose > * {
  animation: fadeIn 0.5s ease-out forwards;
  opacity: 0;
}

/* Stagger children animations */
.prose > *:nth-child(1) { animation-delay: 0.1s; }
.prose > *:nth-child(2) { animation-delay: 0.2s; }
.prose > *:nth-child(3) { animation-delay: 0.3s; }
/* Add more if needed */
</style>
