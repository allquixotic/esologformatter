<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { QScrollArea, useQuasar } from 'quasar'
import DiffView from '@/components/DiffView.vue'
import { generate } from '@/app/runner'
import { uneditedName } from '@/core/naming'
import { downloadText } from '@/fs/access'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'

const $q = useQuasar()
const session = useSessionStore()
const settings = useSettingsStore()

const logScroll = ref<InstanceType<typeof QScrollArea> | null>(null)

watch(
  () => session.log.length,
  async () => {
    if (settings.followTechnicalLog) {
      await nextTick()
      logScroll.value?.setScrollPercentage('vertical', 1)
    }
  },
)

const hasResult = computed(() => session.result !== null)
const ready = computed(() => session.hasInput)

async function run(): Promise<void> {
  try {
    await generate()
    const r = session.result
    $q.notify({
      type: 'positive',
      message: r?.writtenTo
        ? `Generated ${r.filename} and saved it to \u201c${r.writtenTo}\u201d.`
        : `Generated ${r?.filename ?? 'output'}.`,
    })
  } catch (err) {
    $q.notify({ type: 'negative', message: (err as Error).message })
  }
}

function fmtAt(at: number): string {
  return `[+${at.toFixed(1)} ms]`
}

function download(): void {
  const r = session.result
  if (!r) return
  downloadText(r.filename, r.content, r.mime)
  if (r.unedited !== undefined) {
    downloadText(uneditedName(r.filename), r.unedited)
  }
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 3 — Generate</div>
    </q-card-section>

    <q-card-section class="q-pt-none column q-gutter-md">
      <div class="row q-gutter-sm items-center">
        <q-btn
          color="primary"
          size="lg"
          icon="play_arrow"
          label="Generate"
          :disable="!ready"
          :loading="session.running"
          @click="run"
        />
        <div v-if="!ready" class="text-caption text-grey">
          Load a chat log in Step 2 first.
        </div>
        <div v-if="session.running && session.currentStage" class="text-caption text-grey">
          {{ session.currentStage }}…
        </div>
      </div>
      <q-linear-progress v-if="session.running" indeterminate color="primary" />

      <q-expansion-item
        v-model="settings.showTechnicalLog"
        icon="terminal"
        label="Technical log"
        dense
      >
        <div class="row items-center q-px-sm">
          <q-space />
          <q-toggle v-model="settings.followTechnicalLog" dense label="Auto-scroll" />
        </div>
        <q-scroll-area ref="logScroll" style="height: 220px" class="log-area q-pa-sm">
          <div
            v-for="(event, i) in session.log"
            :key="i"
            class="log-line"
            :class="{
              'text-negative': event.kind === 'error',
              'text-weight-medium': event.kind === 'begin' || event.kind === 'end',
            }"
          >
            {{ fmtAt(event.at) }} {{ event.message }}
          </div>
          <div v-if="session.log.length === 0" class="text-grey text-caption">
            Run Generate to see processing stages here.
          </div>
        </q-scroll-area>
      </q-expansion-item>

      <template v-if="hasResult && session.result">
        <q-separator />

        <div class="row q-gutter-sm items-center">
          <q-chip icon="description" color="primary" text-color="white">
            {{ session.result.filename }}
          </q-chip>
          <q-chip
            v-if="session.result.writtenTo"
            icon="folder"
            color="positive"
            text-color="white"
          >
            Saved to “{{ session.result.writtenTo }}”
          </q-chip>
          <q-btn color="primary" icon="download" label="Download" @click="download" />
        </div>

        <q-expansion-item icon="preview" label="Preview" default-opened dense>
          <q-scroll-area style="height: 320px" class="log-area q-pa-sm">
            <pre class="preview-pre">{{ session.result.content }}</pre>
          </q-scroll-area>
        </q-expansion-item>

        <q-expansion-item
          v-if="session.diffParts && session.diffParts.length > 0"
          icon="difference"
          label="AI changes (diff)"
          dense
        >
          <q-scroll-area style="height: 320px" class="log-area q-pa-sm">
            <DiffView :parts="session.diffParts" />
          </q-scroll-area>
        </q-expansion-item>
      </template>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.log-area {
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 4px;
}
.log-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
}
.preview-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
</style>
