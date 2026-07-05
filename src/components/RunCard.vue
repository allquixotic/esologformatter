<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { QScrollArea, useQuasar } from 'quasar'
import DiffView from '@/components/DiffView.vue'
import { generate } from '@/app/runner'
import { uneditedName } from '@/core/naming'
import {
  downloadText,
  isAbortError,
  pickOutputDirectory,
  saveTextAs,
  supportsDirectoryPicker,
  supportsSaveAs,
  verifyPermission,
  writeFileToDirectory,
} from '@/fs/access'
import {
  clearOutputDirectory,
  loadOutputDirectory,
  rememberOutputDirectory,
} from '@/fs/handles'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'

const $q = useQuasar()
const session = useSessionStore()
const settings = useSettingsStore()

const logScroll = ref<InstanceType<typeof QScrollArea> | null>(null)
const dirHandle = ref<FileSystemDirectoryHandle | null>(null)

onMounted(async () => {
  if (supportsDirectoryPicker) {
    try {
      dirHandle.value = (await loadOutputDirectory()) ?? null
    } catch {
      dirHandle.value = null
    }
  }
})

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

async function run(): Promise<void> {
  try {
    await generate()
    $q.notify({ type: 'positive', message: `Generated ${session.result?.filename ?? 'output'}.` })
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

async function saveAs(): Promise<void> {
  const r = session.result
  if (!r) return
  try {
    await saveTextAs(r.filename, r.content)
    if (r.unedited !== undefined) {
      await saveTextAs(uneditedName(r.filename), r.unedited)
    }
    $q.notify({ type: 'positive', message: 'Saved.' })
  } catch (err) {
    if (!isAbortError(err)) {
      $q.notify({ type: 'negative', message: `Save failed: ${(err as Error).message}` })
    }
  }
}

async function chooseDirectory(): Promise<void> {
  try {
    const handle = await pickOutputDirectory()
    dirHandle.value = handle
    await rememberOutputDirectory(handle)
    $q.notify({ type: 'positive', message: `Output folder set to "${handle.name}".` })
  } catch (err) {
    if (!isAbortError(err)) {
      $q.notify({ type: 'negative', message: `Could not open folder: ${(err as Error).message}` })
    }
  }
}

async function forgetDirectory(): Promise<void> {
  dirHandle.value = null
  await clearOutputDirectory()
}

async function writeToDirectory(): Promise<void> {
  const r = session.result
  if (!r) return
  if (!dirHandle.value) {
    await chooseDirectory()
  }
  const handle = dirHandle.value
  if (!handle) return
  try {
    if (!(await verifyPermission(handle, true))) {
      $q.notify({ type: 'warning', message: 'Write permission to the folder was not granted.' })
      return
    }
    await writeFileToDirectory(handle, r.filename, r.content)
    if (r.unedited !== undefined) {
      await writeFileToDirectory(handle, uneditedName(r.filename), r.unedited)
    }
    $q.notify({ type: 'positive', message: `Wrote ${r.filename} to "${handle.name}".` })
  } catch (err) {
    $q.notify({ type: 'negative', message: `Write failed: ${(err as Error).message}` })
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
          :loading="session.running"
          @click="run"
        />
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
          <q-btn color="primary" icon="download" label="Download" @click="download" />
          <q-btn
            v-if="supportsSaveAs"
            outline
            color="primary"
            icon="save_as"
            label="Save as…"
            @click="saveAs"
          />
          <template v-if="supportsDirectoryPicker">
            <q-btn
              outline
              color="secondary"
              icon="folder"
              :label="dirHandle ? `Write to \u201c${dirHandle.name}\u201d` : 'Write to folder…'"
              @click="writeToDirectory"
            />
            <q-btn
              v-if="dirHandle"
              flat
              dense
              icon="folder_off"
              aria-label="Forget output folder"
              @click="forgetDirectory"
            >
              <q-tooltip>Forget output folder ({{ dirHandle.name }})</q-tooltip>
            </q-btn>
          </template>
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
