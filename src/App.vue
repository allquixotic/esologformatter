<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import AiCard from '@/components/AiCard.vue'
import ChannelsCard from '@/components/ChannelsCard.vue'
import InputCard from '@/components/InputCard.vue'
import InstructionsCard from '@/components/InstructionsCard.vue'
import OptionsCard from '@/components/OptionsCard.vue'
import RunCard from '@/components/RunCard.vue'
import { completeOAuthLogin } from '@/llm/openrouter'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore, type ThemePreference } from '@/stores/settings'

const $q = useQuasar()
const settings = useSettingsStore()
const session = useSessionStore()

settings.applyTheme()
settings.$subscribe(() => {
  settings.persist()
})

const themeIcon = computed(() => {
  if (settings.theme === 'system') return 'brightness_auto'
  return settings.theme === 'dark' ? 'dark_mode' : 'light_mode'
})

const themeOptions: { label: string; value: ThemePreference; icon: string }[] = [
  { label: 'Dark (default)', value: 'dark', icon: 'dark_mode' },
  { label: 'Light', value: 'light', icon: 'light_mode' },
  { label: 'System', value: 'system', icon: 'brightness_auto' },
]

onMounted(async () => {
  try {
    const key = await completeOAuthLogin()
    if (key) {
      settings.setApiKey(key)
      $q.notify({ type: 'positive', message: 'OpenRouter connected — API key saved in this browser.' })
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: `OpenRouter login failed: ${(err as Error).message}` })
  }
})
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>
          ESO Log Formatter
        </q-toolbar-title>

        <q-btn-dropdown flat :icon="themeIcon" aria-label="Theme">
          <q-list>
            <q-item
              v-for="opt in themeOptions"
              :key="opt.value"
              v-close-popup
              clickable
              :active="settings.theme === opt.value"
              @click="settings.setTheme(opt.value)"
            >
              <q-item-section avatar>
                <q-icon :name="opt.icon" />
              </q-item-section>
              <q-item-section>{{ opt.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>

        <q-btn
          flat
          round
          icon="code"
          aria-label="View source on GitHub"
          href="https://github.com/allquixotic/esologformatter"
          target="_blank"
          rel="noopener"
        />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page padding>
        <div class="column q-gutter-md q-mx-auto" style="max-width: 1100px">
          <InstructionsCard />
          <InputCard />
          <template v-if="session.hasInput">
            <OptionsCard />
            <ChannelsCard v-if="settings.outputFormat !== 'narrative'" />
            <AiCard v-if="settings.outputFormat !== 'table'" />
            <RunCard />
          </template>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>
